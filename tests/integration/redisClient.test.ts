/**
 * The shared Redis client against a real Redis: one client per process, usable
 * before it has finished connecting.
 *
 *   TEST_REDIS_URL=redis://localhost:6379 npx vitest run tests/integration/redisClient.test.ts
 */

import { afterAll, describe, expect, it } from 'vitest';
import { closeRedis, getRedisClient } from '~/utils/redis.server';

const url = process.env.TEST_REDIS_URL;
const isLocal = Boolean(url && /^redis:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/\d+)?$/.test(url));
if (url && !isLocal) throw new Error(`TEST_REDIS_URL must be a local Redis, got ${url}`);

describe.skipIf(!isLocal)('getRedisClient (real Redis)', () => {
  afterAll(async () => {
    await closeRedis();
    delete process.env.REDIS_URL;
  });

  it('hands every caller the same client while it is still connecting', async () => {
    process.env.REDIS_URL = url;
    const first = getRedisClient();
    expect(first.status).not.toBe('ready');
    // Replacing a connecting client used to fail the commands queued on it.
    const pings = await Promise.all([first.ping(), getRedisClient().ping(), getRedisClient().ping()]);
    expect(pings).toEqual(['PONG', 'PONG', 'PONG']);
    expect(getRedisClient()).toBe(first);
  });

  it('makes a new client once the old one has ended', async () => {
    const old = getRedisClient();
    old.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    const fresh = getRedisClient();
    expect(fresh).not.toBe(old);
    expect(await fresh.ping()).toBe('PONG');
  });
});
