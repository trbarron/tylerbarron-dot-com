import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createActionArgs } from '../setup';

const mocks = vi.hoisted(() => ({
  counts: new Map<string, number>(),
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn(),
  joinGame: vi.fn(),
  cooldown: vi.fn(),
}));
vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => ({
    ...mocks,
    incr: async (key: string) => {
      const count = (mocks.counts.get(key) ?? 0) + 1;
      mocks.counts.set(key, count);
      return count;
    },
  }),
}));
vi.mock('~/utils/collaborativeCheckmate/game.server', () => ({ joinGame: mocks.joinGame }));
vi.mock('~/utils/chesserGuesser/rateLimit.server', () => ({ rateLimitMiddleware: mocks.cooldown }));

import { action as blunderSubmit } from '~/routes/api/blunderWatch/submit';
import { action as chesserSubmit } from '~/routes/api/chesserGuesser/submit';
import { action as join } from '~/routes/api/collaborativeCheckmate/join';

const post = (body: unknown, ip = '203.0.113.7') =>
  createActionArgs('/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cloudfront-viewer-address': `${ip}:12345` },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.counts.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 0, 15, 12));
  mocks.get.mockResolvedValue(null);
  mocks.joinGame.mockResolvedValue({ id: 'g1' });
  mocks.cooldown.mockResolvedValue(null);
});
afterEach(() => vi.useRealTimers());

describe('per-address writer limits', () => {
  it.each([
    { name: 'Blunder Watch', action: blunderSubmit, max: 10, body: { flags: [] }, status: 404 },
    { name: 'Chesser Guesser', action: chesserSubmit, max: 40, body: { puzzleIndex: 0, guess: 100 }, status: 404 },
    { name: 'Collaborative Checkmate', action: join, max: 60, body: { gameId: 'g1' }, status: 200 },
  ])('$name limits changing usernames from the same address', async ({ action, max, body, status }) => {
    for (let i = 0; i < max; i++) {
      expect((await action(post({ ...body, username: `user${i}`, playerId: `user${i}` }))).status).toBe(status);
    }
    mocks.get.mockClear();
    mocks.joinGame.mockClear();
    mocks.cooldown.mockClear();
    const response = await action(post({ ...body, username: 'another', playerId: 'another' }));
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('3600');
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.setex).not.toHaveBeenCalled();
    expect(mocks.zadd).not.toHaveBeenCalled();
    expect(mocks.joinGame).not.toHaveBeenCalled();
    expect(mocks.cooldown).not.toHaveBeenCalled();
    expect((await action(post({ ...body, username: 'another', playerId: 'another' }, '203.0.113.8'))).status).toBe(
      status,
    );
  });
});

describe.each([
  { name: 'Blunder Watch', action: blunderSubmit, body: { username: 'ann', flags: [] } },
  { name: 'Chesser Guesser', action: chesserSubmit, body: { username: 'ann', puzzleIndex: 0, guess: 100 } },
])('$name daily submissions', ({ action, body }) => {
  it.each(['2024-01-13', '2024-01-16', '2024-02-30', ['2024-01-15'], ''])(
    'rejects date %j before counting or writing',
    async (date) => {
      expect((await action(post({ ...body, date }))).status).toBe(400);
      expect(mocks.counts.size).toBe(0);
      expect(mocks.get).not.toHaveBeenCalled();
      expect(mocks.cooldown).not.toHaveBeenCalled();
    },
  );

  it.each(['2024-01-15', '2024-01-14', undefined])('accepts a current or yesterday date %j', async (date) => {
    // Reaching the missing-puzzle response proves the date passed validation.
    expect((await action(post({ ...body, date }))).status).toBe(404);
    expect(mocks.counts.size).toBe(1);
  });
});
