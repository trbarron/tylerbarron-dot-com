import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { closeRedis, getRedisClient } from '~/utils/redis.server';
import { listRecorderScores, playerKey, saveRecorderScore } from '~/utils/vampireSurvivors/leaderboard.server';

const url = process.env.TEST_REDIS_URL;
const isLocal = Boolean(url && /^redis:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/\d+)?$/.test(url));
if (url && !isLocal) throw new Error('TEST_REDIS_URL must point to local Redis');

describe.skipIf(!isLocal)('Vampire Survivors leaderboard (real Redis)', () => {
  const name = `Score test ${randomUUID().slice(0, 12)}`;

  afterAll(async () => {
    const redis = getRedisClient();
    await redis.zrem('{vampire-survivors}:leaderboard:v1:ranks', playerKey(name));
    await redis.hdel('{vampire-survivors}:leaderboard:v1:results', playerKey(name));
    await closeRedis();
    delete process.env.REDIS_URL;
  });

  it('keeps one complete best run through concurrent updates and resubmissions', async () => {
    process.env.REDIS_URL = url;
    const first = { name, seed: 11, time: 720, level: 13, kills: 1200 };
    const better = { ...first, name: name.toUpperCase(), seed: 12, kills: 1201 };
    const shorter = { ...first, seed: 13, time: 719, kills: 8000 };
    await Promise.all([saveRecorderScore(first), saveRecorderScore(better), saveRecorderScore(shorter)]);

    expect(await saveRecorderScore(better)).toBe(false);
    expect(await saveRecorderScore(first)).toBe(false);
    expect((await listRecorderScores()).filter((score) => playerKey(score.name) === playerKey(name))).toEqual([better]);
  });
});
