import { beforeEach, expect, it, vi } from 'vitest';
import { gzipSync } from 'node:zlib';

const redis = vi.hoisted(() => ({ get: vi.fn(), getBuffer: vi.fn() }));
vi.mock('~/utils/redis.server', () => ({ getRedisClient: () => redis }));
import { readSnapshot } from '~/utils/runescapeRascals/snapshot.server';

beforeEach(() => vi.resetAllMocks());

it('reads the permanent archive after all live keys expire', async () => {
  const saved = { generatedAt: 123, bots: [], log: [], history: [] };
  redis.get.mockResolvedValue(null);
  redis.getBuffer.mockResolvedValue(gzipSync(JSON.stringify(saved)));
  expect(await readSnapshot()).toEqual(saved);
  expect(redis.getBuffer).toHaveBeenCalledWith('runescapeRascals:archive');
});

it('prefers a live publication over the archive', async () => {
  const live = { generatedAt: 456, bots: [], log: [], history: [] };
  redis.get.mockImplementation(async (key) => (key.endsWith(':fast') ? null : JSON.stringify(live)));
  expect(await readSnapshot()).toEqual(live);
  expect(redis.getBuffer).not.toHaveBeenCalled();
});

it('returns null when neither live nor archived data exists', async () => {
  redis.get.mockResolvedValue(null);
  redis.getBuffer.mockResolvedValue(null);
  expect(await readSnapshot()).toBeNull();
});
