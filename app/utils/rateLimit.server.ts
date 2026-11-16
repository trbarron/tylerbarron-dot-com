// Per-IP fixed-window rate limiting, shared by the endpoints that only need to
// stop someone filling Redis with junk (Maia decks, Media Profile shares). One
// INCR per check: `ratelimit:{scope}:{bucket}:{ip}:{window}`.
//
// Deliberately simpler than the sliding-window limiter in
// `~/utils/chesserGuesser/rateLimit.server`, which exists to make a daily
// puzzle allowance exact.

import { getRedisClient } from '~/utils/redis.server';

export interface RateLimit {
  max: number;
  windowSeconds: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  retryAfter: number;
}

/**
 * The caller's IP, for bucketing rate limits and nothing else.
 *
 * The viewer-request function overwrites `x-site-viewer-ip` with event.viewer.ip.
 * The production origin guard makes that trustworthy by refusing direct callers.
 * The legacy headers remain fallbacks for local development and older deployments;
 * a caller can forge them when they are not supplied by trusted infrastructure.
 */
export function clientIp(request: Request): string {
  const stamped = request.headers.get('x-site-viewer-ip')?.trim();
  if (stamped) return stamped;
  const viewer = request.headers.get('cloudfront-viewer-address');
  if (viewer) {
    // "203.0.113.7:46532", or for IPv6 "2001:db8::1:46532" / "[2001:db8::1]:46532".
    const ip = viewer
      .trim()
      .replace(/:\d+$/, '')
      .replace(/^\[|\]$/g, '');
    if (ip) return ip;
  }
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  bucket: string,
  limit: RateLimit,
): Promise<RateLimitVerdict> {
  try {
    const redis = getRedisClient();
    const window = Math.floor(Date.now() / 1000 / limit.windowSeconds);
    const key = `ratelimit:${scope}:${bucket}:${clientIp(request)}:${window}`;

    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, limit.windowSeconds * 2);

    if (count > limit.max) return { allowed: false, retryAfter: limit.windowSeconds };
    return { allowed: true, retryAfter: 0 };
  } catch (error) {
    // Fail open: a Redis blip shouldn't take the feature down, and these
    // endpoints don't protect anything valuable enough to justify failing closed.
    console.error(`${scope} rate limit check failed:`, error);
    return { allowed: true, retryAfter: 0 };
  }
}
