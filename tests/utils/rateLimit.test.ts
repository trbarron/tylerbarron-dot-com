/**
 * The shared fixed-window rate limiter.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const counts = new Map<string, number>();
const expiries = new Map<string, number>();
let failing = false;
vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => ({
    incr: async (key: string) => {
      if (failing) throw new Error('connection lost');
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key)!;
    },
    expire: async (key: string, seconds: number) => void expiries.set(key, seconds),
  }),
}));

import { checkRateLimit, clientIp } from '~/utils/rateLimit.server';

const req = (headers: Record<string, string> = {}) => new Request('http://localhost/x', { headers });
const limit = { max: 2, windowSeconds: 60 };

beforeEach(() => {
  counts.clear();
  expiries.clear();
  failing = false;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('checkRateLimit', () => {
  it('allows up to max per window, then asks the caller to wait a window', async () => {
    const r = req({ 'x-forwarded-for': '1.1.1.1' });
    expect(await checkRateLimit(r, 'tool', 'save', limit)).toEqual({ allowed: true, retryAfter: 0 });
    expect(await checkRateLimit(r, 'tool', 'save', limit)).toEqual({ allowed: true, retryAfter: 0 });
    expect(await checkRateLimit(r, 'tool', 'save', limit)).toEqual({ allowed: false, retryAfter: 60 });
  });

  it('keeps tools, buckets and addresses apart, under the existing key names', async () => {
    await checkRateLimit(req({ 'x-forwarded-for': '1.1.1.1' }), 'maiaDrills', 'save', limit);
    await checkRateLimit(req({ 'x-forwarded-for': '2.2.2.2' }), 'mediaProfile', 'share', limit);
    const window = Math.floor(Date.now() / 1000 / 60);
    expect([...counts.keys()].sort()).toEqual([
      `ratelimit:maiaDrills:save:1.1.1.1:${window}`,
      `ratelimit:mediaProfile:share:2.2.2.2:${window}`,
    ]);
    // Expires two windows later, so a window's key outlives it slightly.
    expect([...expiries.values()]).toEqual([120, 120]);
  });

  it('fails open when Redis is down', async () => {
    failing = true;
    expect(await checkRateLimit(req(), 'tool', 'save', limit)).toEqual({ allowed: true, retryAfter: 0 });
  });
});

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry, then x-real-ip', () => {
    expect(clientIp(req({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('9.9.9.9');
    expect(clientIp(req({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8');
    expect(clientIp(req())).toBe('unknown');
  });
});
