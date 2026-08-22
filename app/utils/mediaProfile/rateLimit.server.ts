// Per-IP fixed-window rate limiting for the media profile share endpoint.
//
// Deliberately simpler than the sliding-window limiter in
// `~/utils/chesserGuesser/rateLimit.server`: that one exists to make a daily
// puzzle allowance exact. This endpoint only needs to stop someone filling
// Redis with junk, and a fixed window does that in one round trip.

import { getRedisClient } from '~/utils/redis.server';

export const SHARE_LIMIT = { max: 20, windowSeconds: 3600 };
export const READ_LIMIT = { max: 120, windowSeconds: 60 };

/**
 * Edits are cheap for the author and the only way to probe an edit token, so
 * this window is tighter than the share window rather than looser: 50 bits of
 * token against 30 attempts an hour is not a search anyone finishes.
 */
export const EDIT_LIMIT = { max: 30, windowSeconds: 3600 };

/** The public listing is one Redis round trip and renders for everyone. */
export const LIST_LIMIT = { max: 60, windowSeconds: 60 };

export interface RateLimitVerdict {
  allowed: boolean;
  retryAfter: number;
}

/**
 * Read the caller's IP. API Gateway sits behind CloudFront here, so
 * x-forwarded-for is the only header that carries it, and the client-supplied
 * portion is untrusted — take the first entry and use it for nothing but
 * bucketing.
 */
function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function checkRateLimit(
  request: Request,
  bucket: string,
  limit: { max: number; windowSeconds: number }
): Promise<RateLimitVerdict> {
  try {
    const redis = getRedisClient();
    const window = Math.floor(Date.now() / 1000 / limit.windowSeconds);
    const key = `ratelimit:mediaProfile:${bucket}:${getClientIp(request)}:${window}`;

    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, limit.windowSeconds * 2);

    if (count > limit.max) {
      return { allowed: false, retryAfter: limit.windowSeconds };
    }
    return { allowed: true, retryAfter: 0 };
  } catch (error) {
    // Fail open, matching the chesserGuesser limiter: a Redis blip should not
    // take the feature down, and the endpoint is not protecting anything
    // valuable enough to justify failing closed.
    console.error('mediaProfile rate limit check failed:', error);
    return { allowed: true, retryAfter: 0 };
  }
}
