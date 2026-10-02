import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  claimDailyTournamentSlot,
  returnDailyTournamentSlot,
  MAX_TOURNAMENTS_PER_DAY,
} from '~/utils/camelUpCup/tournament.server';

// In-memory Redis counter
const counters = new Map<string, number>();
const mockRedis = {
  incr: vi.fn(async (key: string) => {
    counters.set(key, (counters.get(key) ?? 0) + 1);
    return counters.get(key)!;
  }),
  decr: vi.fn(async (key: string) => {
    counters.set(key, (counters.get(key) ?? 0) - 1);
    return counters.get(key)!;
  }),
  expire: vi.fn(async () => 1),
};

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

describe('Camel Up Cup daily tournament cap', () => {
  beforeEach(() => {
    counters.clear();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows MAX_TOURNAMENTS_PER_DAY starts, then refuses', async () => {
    for (let i = 0; i < MAX_TOURNAMENTS_PER_DAY; i++) {
      expect(await claimDailyTournamentSlot()).toBe(true);
    }
    expect(await claimDailyTournamentSlot()).toBe(false);
  });

  it('keys the counter by UTC date and sets its expiry once', async () => {
    await claimDailyTournamentSlot();
    await claimDailyTournamentSlot();
    expect(mockRedis.incr).toHaveBeenCalledWith('camelup:daily:2026-10-02');
    expect(mockRedis.expire).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh count on the next UTC day', async () => {
    for (let i = 0; i < MAX_TOURNAMENTS_PER_DAY; i++) await claimDailyTournamentSlot();
    vi.setSystemTime(new Date('2026-10-03T00:00:01Z'));
    expect(await claimDailyTournamentSlot()).toBe(true);
  });

  it('a returned slot can be claimed again', async () => {
    for (let i = 0; i < MAX_TOURNAMENTS_PER_DAY; i++) await claimDailyTournamentSlot();
    await returnDailyTournamentSlot();
    expect(await claimDailyTournamentSlot()).toBe(true);
  });

  it('fails closed when Redis is down', async () => {
    mockRedis.incr.mockRejectedValueOnce(new Error('connection refused'));
    await expect(claimDailyTournamentSlot()).rejects.toThrow('connection refused');
  });
});
