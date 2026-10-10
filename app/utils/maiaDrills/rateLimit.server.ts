// Per-IP fixed-window rate limiting for the Maia Drills deck endpoint. Same
// shape as `~/utils/mediaProfile/rateLimit.server`: it only needs to stop
// someone filling Redis with junk decks.

import { getRedisClient } from '~/utils/redis.server';

/** A deck takes minutes of local analysis to build; 20 an hour is plenty. */
export const SAVE_LIMIT = { max: 20, windowSeconds: 3600 };
/** Favoriting is the only way to probe an edit token. */
export const FAVORITE_LIMIT = { max: 60, windowSeconds: 3600 };
export const READ_LIMIT = { max: 120, windowSeconds: 60 };

export interface RateLimitVerdict {
  allowed: boolean;
  retryAfter: number;
}

/** First x-forwarded-for entry: CloudFront → API Gateway puts the client there. */
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
    const key = `ratelimit:maiaDrills:${bucket}:${getClientIp(request)}:${window}`;

    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, limit.windowSeconds * 2);

    if (count > limit.max) return { allowed: false, retryAfter: limit.windowSeconds };
    return { allowed: true, retryAfter: 0 };
  } catch (error) {
    // Fail open, matching the other limiters: a Redis blip shouldn't take the feature down.
    console.error('maiaDrills rate limit check failed:', error);
    return { allowed: true, retryAfter: 0 };
  }
}
