/**
 * POST /api/camelUpCup/submit: a valid bot is queued in Redis and Tyler is
 * emailed. The site never runs the code.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createActionArgs } from '../setup';

const hash = new Map<string, string>();
const redis = {
  hlen: vi.fn(async () => hash.size),
  hset: vi.fn(async (_key: string, id: string, value: string) => void hash.set(id, value)),
  incr: vi.fn(async () => 1),
  expire: vi.fn(async () => 1),
};
vi.mock('~/utils/redis.server', () => ({ getRedisClient: () => redis }));

const sns = vi.hoisted(() => ({ send: vi.fn(), regions: [] as string[] }));
vi.mock('@aws-sdk/client-sns', () => ({
  SNSClient: class {
    constructor({ region }: { region: string }) {
      sns.regions.push(region);
    }
    send = sns.send;
  },
  PublishCommand: class {
    constructor(public input: Record<string, string>) {}
  },
}));

import { action } from '~/routes/api/camelUpCup/submit';
import { MAX_PENDING, emailSubject } from '~/utils/camelUpCup/tournament.server';

const BOT = 'class Bot:\n    def move(self, player, gamestate):\n        return [0]\n';
const TOPIC = 'arn:aws:sns:us-east-1:123456789012:camel-up-cup';

function submit(fields: Record<string, string> = {}, code = BOT) {
  const form = new FormData();
  form.set('botName', fields.botName ?? 'DiceRoller');
  form.set('author', fields.author ?? 'Fred');
  form.set('file', new File([code], 'bot.py'));
  return action(createActionArgs('/api/camelUpCup/submit', { method: 'POST', body: form }));
}

beforeEach(() => {
  hash.clear();
  vi.clearAllMocks();
  sns.regions.length = 0;
  sns.send.mockResolvedValue({});
  redis.incr.mockResolvedValue(1);
  process.env.CAMEL_NOTIFY_TOPIC_ARN = TOPIC;
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('POST /api/camelUpCup/submit', () => {
  it('queues the bot and emails it, code included', async () => {
    const res = await submit();
    expect(res.status).toBe(200);
    const { id, botName, waiting } = await res.json();
    expect(id).toMatch(/^sub-[0-9a-f-]{36}$/);
    expect({ botName, waiting }).toEqual({ botName: 'DiceRoller', waiting: 1 });
    expect(JSON.parse(hash.get(id)!)).toMatchObject({ id, botName: 'DiceRoller', author: 'Fred', code: BOT });

    const { input } = sns.send.mock.calls[0][0];
    expect(input.TopicArn).toBe(TOPIC);
    expect(input.Subject).toBe('Camel Up Cup: DiceRoller by Fred');
    expect(input.Message).toContain(id);
    expect(input.Message).toContain(BOT);
    // The topic's region, not the Lambda's.
    expect(sns.regions).toEqual(['us-east-1']);
  });

  it('still accepts the bot when the email fails or is not configured', async () => {
    sns.send.mockRejectedValue(new Error('AccessDenied'));
    expect((await submit()).status).toBe(200);
    delete process.env.CAMEL_NOTIFY_TOPIC_ARN;
    expect((await submit({ botName: 'Second' })).status).toBe(200);
    expect(hash.size).toBe(2);
  });

  it('rejects a bad bot before storing or emailing anything', async () => {
    expect((await submit({}, 'import os\nclass B:\n    def move(self, p, g):\n        return [0]\n')).status).toBe(400);
    expect((await submit({ botName: '../etc' })).status).toBe(400);
    expect(hash.size).toBe(0);
    expect(sns.send).not.toHaveBeenCalled();
  });

  it('stops at three an hour per address, and when the waiting list is full', async () => {
    redis.incr.mockResolvedValue(4);
    expect((await submit()).status).toBe(429);
    redis.incr.mockResolvedValue(1);
    for (let i = 0; i < MAX_PENDING; i++) hash.set(`sub-${i}`, '{}');
    expect((await submit()).status).toBe(429);
    expect(hash.size).toBe(MAX_PENDING);
    expect(sns.send).not.toHaveBeenCalled();
  });

  it('does not report a bot as entered when it could not be stored', async () => {
    redis.hset.mockRejectedValueOnce(new Error('connection lost'));
    expect((await submit()).status).toBe(500);
    expect(sns.send).not.toHaveBeenCalled();
  });
});

describe('emailSubject', () => {
  it('is one ASCII line under 100 characters, whatever the author typed', () => {
    const subject = emailSubject({ botName: 'B'.repeat(24), author: 'Zoë\nBcc: x@y.z ' + 'a'.repeat(40) });
    expect(subject).toMatch(/^[\x20-\x7e]{1,99}$/);
  });
});
