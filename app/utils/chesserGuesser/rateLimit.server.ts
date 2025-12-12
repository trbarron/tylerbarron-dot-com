// Rate limiting utilities for ChesserGuesser API endpoints
// Prevents abuse and ensures fair play

import { getRedisClient } from '../redis.server';

/**
 * Rate limit configuration
 */
export const RATE_LIMITS = {
  // Submission limits (per user)
  submission: {
    maxPerDay: 4, // Maximum 4 puzzles per day
    windowSeconds: 86400, // 24-hour window
    cooldownSeconds: 2, // Minimum 2 seconds between submissions
  },

  // Leaderboard query limits (per IP)
  leaderboard: {
    maxPerMinute: 30, // Maximum 30 queries per minute
    windowSeconds: 60,
  },

  // Puzzle fetch limits (per IP)
  puzzles: {
    maxPerMinute: 20, // Maximum 20 fetches per minute
    windowSeconds: 60,
  },
} as const;

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp when limit resets
  retryAfter?: number; // Seconds to wait before retrying (if not allowed)
}

/**
 * Get client IP from request
 */
function getClientIP(request: Request): string {
  // Check common proxy headers
  const headers = request.headers;
  const forwardedFor = headers.get('x-forwarded-for');
  const realIP = headers.get('x-real-ip');
  const cfConnectingIP = headers.get('cf-connecting-ip'); // Cloudflare

  // Use first IP from X-Forwarded-For
  if (forwardedFor) {
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }

  if (realIP) {
    return realIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback
  return 'unknown';
}

/**
 * Check rate limit using Redis
 * Implements sliding window counter algorithm
 */
async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    // Use sorted set with timestamps as scores
    const zKey = `ratelimit:${key}`;

    // Remove old entries outside the window
    await redis.zremrangebyscore(zKey, 0, windowStart);

    // Count current requests in window
    const currentCount = await redis.zcard(zKey);

    // Calculate when the limit will reset
    const oldestEntry = await redis.zrange(zKey, 0, 0, 'WITHSCORES');
    const resetAt = oldestEntry.length > 1
      ? parseInt(oldestEntry[1], 10) + windowSeconds * 1000
      : now + windowSeconds * 1000;

    if (currentCount >= maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }

    // Add current request
    await redis.zadd(zKey, now, `${now}-${Math.random()}`);

    // Set expiration to cleanup
    await redis.expire(zKey, windowSeconds * 2);

    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetAt,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);

    // Fail open (allow request on error)
    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: now + windowSeconds * 1000,
    };
  }
}

/**
 * Check rate limit for puzzle submissions
 * Enforces maximum 4 submissions per day per user
 */
export async function checkSubmissionRateLimit(
  username: string,
  date: string
): Promise<RateLimitResult> {
  const key = `submission:${date}:${username}`;

  return checkRateLimit(
    key,
    RATE_LIMITS.submission.maxPerDay,
    RATE_LIMITS.submission.windowSeconds
  );
}

/**
 * Check cooldown between submissions
 * Prevents rapid-fire submissions
 */
export async function checkSubmissionCooldown(
  username: string
): Promise<RateLimitResult> {
  const key = `cooldown:${username}`;

  return checkRateLimit(
    key,
    1,
    RATE_LIMITS.submission.cooldownSeconds
  );
}

/**
 * Check rate limit for leaderboard queries
 * Prevents excessive API calls
 */
export async function checkLeaderboardRateLimit(
  request: Request
): Promise<RateLimitResult> {
  const ip = getClientIP(request);
  const key = `leaderboard:${ip}`;

  return checkRateLimit(
    key,
    RATE_LIMITS.leaderboard.maxPerMinute,
    RATE_LIMITS.leaderboard.windowSeconds
  );
}

/**
 * Check rate limit for puzzle fetches
 * Prevents excessive API calls
 */
export async function checkPuzzleRateLimit(
  request: Request
): Promise<RateLimitResult> {
  const ip = getClientIP(request);
  const key = `puzzles:${ip}`;

  return checkRateLimit(
    key,
    RATE_LIMITS.puzzles.maxPerMinute,
    RATE_LIMITS.puzzles.windowSeconds
  );
}

/**
 * Generate rate limit headers for HTTP response
 * Following standard HTTP rate limiting headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.floor(result.resetAt / 1000).toString(),
  };

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Create rate limit error response
 */
export function createRateLimitError(result: RateLimitResult): {
  error: string;
  retryAfter: number;
  resetAt: number;
} {
  return {
    error: 'Rate limit exceeded. Please try again later.',
    retryAfter: result.retryAfter || 0,
    resetAt: result.resetAt,
  };
}

/**
 * Middleware-style rate limit check
 * Returns null if allowed, error response if not
 */
export async function rateLimitMiddleware(
  request: Request,
  endpoint: 'submission' | 'leaderboard' | 'puzzles',
  identifier?: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ error: any; headers: Record<string, string> } | null> {
  let result: RateLimitResult;

  switch (endpoint) {
    case 'submission':
      if (!identifier) {
        throw new Error('Username required for submission rate limit');
      }
      result = await checkSubmissionCooldown(identifier);
      break;

    case 'leaderboard':
      result = await checkLeaderboardRateLimit(request);
      break;

    case 'puzzles':
      result = await checkPuzzleRateLimit(request);
      break;

    default:
      throw new Error(`Unknown endpoint: ${endpoint}`);
  }

  const headers = getRateLimitHeaders(result);

  if (!result.allowed) {
    return {
      error: createRateLimitError(result),
      headers,
    };
  }

  return null;
}

/**
 * Reset rate limit for a specific key (admin function)
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`ratelimit:${key}`);
}

/**
 * Get rate limit info without incrementing counter
 * Useful for displaying limits to users
 */
export async function getRateLimitInfo(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redis = getRedisClient();
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    const zKey = `ratelimit:${key}`;

    // Count current requests without modifying
    const currentCount = await redis.zcount(zKey, windowStart, now);

    const oldestEntry = await redis.zrange(zKey, 0, 0, 'WITHSCORES');
    const resetAt = oldestEntry.length > 1
      ? parseInt(oldestEntry[1], 10) + windowSeconds * 1000
      : now + windowSeconds * 1000;

    return {
      allowed: currentCount < maxRequests,
      remaining: Math.max(0, maxRequests - currentCount),
      resetAt,
      retryAfter: currentCount >= maxRequests
        ? Math.ceil((resetAt - now) / 1000)
        : undefined,
    };
  } catch (error) {
    console.error('Rate limit info error:', error);

    return {
      allowed: true,
      remaining: maxRequests,
      resetAt: now + windowSeconds * 1000,
    };
  }
}
