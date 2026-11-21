import { getRedisClient } from '~/utils/redis.server';

const ranksKey = '{vampire-survivors}:leaderboard:v1:ranks';
const resultsKey = '{vampire-survivors}:leaderboard:v1:results';
const maxKills = 100_000;

export type RecorderScore = {
  name: string;
  /** Null when the run's seed is unknown, such as a score read from a results screen. */
  seed: number | null;
  time: number;
  level: number;
  kills: number;
};

function whole(value: unknown, low: number, high: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= low && value <= high;
}

export function parseRecorderScore(value: unknown): RecorderScore | null {
  if (!value || typeof value !== 'object') return null;
  const fields = value as Record<string, unknown>;
  const name = typeof fields.name === 'string' ? fields.name.normalize('NFKC').trim() : '';
  if (!name || [...name].length > 32 || /\p{C}/u.test(name)) return null;

  const { time, level, kills } = fields;
  const seed = fields.seed ?? null;
  if (
    (seed !== null && !whole(seed, 1, 2147483646)) ||
    !whole(time, 1, 3600) ||
    !whole(level, 1, 500) ||
    !whole(kills, 0, maxKills)
  ) {
    return null;
  }
  return { name, seed, time, level, kills };
}

export function playerKey(name: string) {
  return name.normalize('NFKC').trim().toLowerCase();
}

const retainBest = `
local previous = redis.call('ZSCORE', KEYS[1], ARGV[1])
if previous and tonumber(previous) >= tonumber(ARGV[2]) then return 0 end
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
return 1
`;

export async function saveRecorderScore(score: RecorderScore): Promise<boolean> {
  const rank = score.time * (maxKills + 1) + score.kills;
  const result = await getRedisClient().eval(
    retainBest,
    2,
    ranksKey,
    resultsKey,
    playerKey(score.name),
    String(rank),
    JSON.stringify(score),
  );
  return result === 1;
}

export async function listRecorderScores(): Promise<RecorderScore[]> {
  const redis = getRedisClient();
  const names = await redis.zrevrange(ranksKey, 0, 99);
  if (!names.length) return [];
  const entries = await redis.hmget(resultsKey, ...names);
  return entries.flatMap((entry) => {
    if (!entry) return [];
    const score = parseRecorderScore(JSON.parse(entry));
    return score ? [score] : [];
  });
}
