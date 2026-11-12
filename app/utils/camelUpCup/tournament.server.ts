// Server-side plumbing for Camel Up Cup bot submissions.
//
// The site doesn't run tournaments. A submission is kept in Redis and Tyler is
// emailed; he pulls the waiting bots (`npm run camel:queue`), runs the
// tournament on his own machine with as many games as he likes, and publishes
// leaderboard.json to the CDN bucket under images/camel-up/, which CloudFront
// serves same-origin (so the read here is a plain fetch).
//
// It used to hand each bot straight to a Lambda that ran strangers' Python on
// submit. That needed a single-run lock, a daily cost cap and a status proxy,
// and played too few games for the standings to mean much.

import { getRedisClient } from '../redis.server';
import { getImageUrl } from '../cdn';
import { checkRateLimit } from '../rateLimit.server';
import type { Leaderboard, PendingSubmission } from './types';

/** Hash of submission id → PendingSubmission JSON. No expiry: it's a to-do list. */
export const PENDING_KEY = 'camelup:pending';
/** Bots waiting at once. Each is up to 64 KB, so this bounds the queue at ~1.6 MB of Redis. */
export const MAX_PENDING = 25;
const SUBMIT_LIMIT = { max: 3, windowSeconds: 3600 };

// ── Leaderboard (CDN JSON) ─────────────────────────────────────────────────

/** getImageUrl returns a relative path in dev; absolutize against the request. */
function cdnJsonUrl(request: Request, path: string): string {
  const url = getImageUrl(path);
  return /^https?:\/\//.test(url) ? url : new URL(url, request.url).toString();
}

export async function fetchLeaderboard(request: Request): Promise<Leaderboard | null> {
  try {
    const res = await fetch(cdnJsonUrl(request, 'camel-up/leaderboard.json'), {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as Leaderboard;
  } catch {
    return null;
  }
}

// ── The queue ──────────────────────────────────────────────────────────────

/** Three submissions an hour per address. Fails open if Redis is down. */
export async function allowSubmission(request: Request): Promise<boolean> {
  return (await checkRateLimit(request, 'camelUpCup', 'submit', SUBMIT_LIMIT)).allowed;
}

/**
 * Add a bot to the waiting list. Returns how many are now waiting, or null
 * when the list is full. A Redis error propagates: a bot that wasn't stored
 * must not be reported as entered.
 */
export async function enqueueSubmission(submission: PendingSubmission): Promise<number | null> {
  const redis = getRedisClient();
  if ((await redis.hlen(PENDING_KEY)) >= MAX_PENDING) return null;
  await redis.hset(PENDING_KEY, submission.id, JSON.stringify(submission));
  return redis.hlen(PENDING_KEY);
}

// ── The email ──────────────────────────────────────────────────────────────

/** SNS subjects are ASCII, one line, under 100 characters. */
export function emailSubject(submission: Pick<PendingSubmission, 'botName' | 'author'>): string {
  const author = submission.author.replace(/[^\x20-\x7e]/g, '?').trim();
  return `Camel Up Cup: ${submission.botName} by ${author}`.slice(0, 99);
}

export function emailBody(submission: PendingSubmission, waiting: number): string {
  return [
    `${submission.botName} by ${submission.author} was entered in the Camel Up Cup.`,
    '',
    `Submission id: ${submission.id}`,
    `Submitted:     ${submission.submitted}`,
    `Waiting now:   ${waiting}`,
    '',
    'To run it, in the site repo:',
    '  npm run camel:queue -- pull ./camel-bots   # writes each waiting bot to a .py file',
    `  npm run camel:queue -- done ${submission.id}   # after the tournament`,
    '',
    "This is a stranger's code. Read it, and run it in a container with no network and nothing mounted.",
    '',
    `──────── ${submission.botName}.py ────────`,
    submission.code,
  ].join('\n');
}

/**
 * Email Tyler through the SNS topic in CAMEL_NOTIFY_TOPIC_ARN. Returns whether
 * it was sent; never throws, because the queue is the record and the email is
 * only the nudge.
 */
export async function notifySubmission(submission: PendingSubmission, waiting: number): Promise<boolean> {
  const topic = process.env.CAMEL_NOTIFY_TOPIC_ARN;
  if (!topic) {
    console.warn(`Camel Up Cup: ${submission.id} queued, but CAMEL_NOTIFY_TOPIC_ARN is not set, so no email.`);
    return false;
  }
  try {
    // Not shipped with the site: Lambda's Node runtime includes the AWS SDK v3.
    // Locally it resolves from the root devDependency. Imported here rather
    // than at the top because every route shares one server bundle, and only a
    // submission needs it.
    const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
    // The topic's own region, which need not be the Lambda's.
    const client = new SNSClient({ region: topic.split(':')[3] });
    await client.send(
      new PublishCommand({
        TopicArn: topic,
        Subject: emailSubject(submission),
        Message: emailBody(submission, waiting),
      }),
    );
    return true;
  } catch (error) {
    console.error(`Camel Up Cup: ${submission.id} queued, but the email failed:`, error);
    return false;
  }
}
