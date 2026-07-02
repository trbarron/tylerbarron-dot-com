// Server-side plumbing for Camel Up Cup bot tournaments.
//
// Submissions are dispatched async to the camel-up-tournament Lambda (fixed
// name, see Camel_Up_Cup_2K18 lambda/deploy.sh). That Lambda publishes
// leaderboard.json and per-submission status JSON to the CDN bucket under
// images/camel-up/, which CloudFront serves same-origin — so reads here are
// plain fetches, no AWS SDK. Only one tournament runs at a time (a full run
// is ~5 chained Lambda invocations over ~1h), guarded by a Redis lock plus
// reserved concurrency of 1 on the Lambda itself.

import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getRedisClient } from "../redis.server";
import { getImageUrl } from "../cdn";
import type { Leaderboard, SubmissionStatus } from "./types";

const LOCK_KEY = "camelup:lock";
const LOCK_TTL_S = 3 * 3600; // outlasts a worst-case tournament run
const RATE_KEY = "camelup:ratelimit:";
const MAX_SUBMISSIONS_PER_HOUR = 3;

export function isTournamentConfigured(): boolean {
  return Boolean(process.env.CAMEL_TOURNAMENT_FUNCTION);
}

export interface SubmissionPayload {
  id: string;
  botName: string;
  author: string;
  code: string;
}

export async function dispatchSubmission(payload: SubmissionPayload): Promise<void> {
  const client = new LambdaClient({});
  await client.send(
    new InvokeCommand({
      FunctionName: process.env.CAMEL_TOURNAMENT_FUNCTION,
      InvocationType: "Event",
      Payload: new TextEncoder().encode(JSON.stringify(payload)),
    })
  );
}

// ── CDN JSON reads ─────────────────────────────────────────────────────────

/** getImageUrl returns a relative path in dev; absolutize against the request. */
function cdnJsonUrl(request: Request, path: string): string {
  const url = getImageUrl(path);
  return /^https?:\/\//.test(url) ? url : new URL(url, request.url).toString();
}

async function fetchCdnJson<T>(request: Request, path: string): Promise<T | null> {
  try {
    const res = await fetch(cdnJsonUrl(request, path), {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function fetchLeaderboard(request: Request): Promise<Leaderboard | null> {
  return fetchCdnJson<Leaderboard>(request, "camel-up/leaderboard.json");
}

export function fetchStatus(request: Request, id: string): Promise<SubmissionStatus | null> {
  return fetchCdnJson<SubmissionStatus>(request, `camel-up/status/${id}.json`);
}

// ── Redis lock + rate limit ────────────────────────────────────────────────

/** Returns true if this submission now holds the single-tournament lock. */
export async function acquireTournamentLock(id: string): Promise<boolean> {
  const redis = getRedisClient();
  const result = await redis.set(LOCK_KEY, id, "EX", LOCK_TTL_S, "NX");
  return result === "OK";
}

/** The submission id currently holding the lock, if any. */
export async function activeTournamentId(): Promise<string | null> {
  try {
    return await getRedisClient().get(LOCK_KEY);
  } catch {
    return null;
  }
}

/**
 * Acquire the lock, stealing it if the holder's tournament already reached a
 * terminal phase (covers runs that finished with nobody polling /status —
 * otherwise the stale lock would block submissions until its TTL).
 */
export async function tryAcquireTournamentLock(
  request: Request,
  id: string
): Promise<boolean> {
  if (await acquireTournamentLock(id)) return true;
  const holder = await activeTournamentId();
  if (!holder) return acquireTournamentLock(id);
  const status = await fetchStatus(request, holder);
  if (status && ["complete", "rejected", "error"].includes(status.phase)) {
    await releaseTournamentLock(holder);
    return acquireTournamentLock(id);
  }
  return false;
}

/** Release the lock, but only if `id` still holds it. */
export async function releaseTournamentLock(id: string): Promise<void> {
  const redis = getRedisClient();
  const holder = await redis.get(LOCK_KEY);
  if (holder === id) {
    await redis.del(LOCK_KEY);
  }
}

export function getClientIP(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

/** Sliding-hour submission limit per IP. Fails open if Redis is down. */
export async function checkSubmissionRateLimit(request: Request): Promise<boolean> {
  try {
    const redis = getRedisClient();
    const key = RATE_KEY + getClientIP(request);
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, 3600);
    }
    return count <= MAX_SUBMISSIONS_PER_HOUR;
  } catch {
    return true;
  }
}
