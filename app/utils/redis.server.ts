// Redis client configuration for server-side use

import Redis from 'ioredis';

let redis: Redis | null = null;

/**
 * Get or create Redis client instance
 * Uses singleton pattern to reuse connection across requests
 */
export function getRedisClient(): Redis {
  // Reuse the client unless it has given up for good. A client that is still
  // connecting or reconnecting queues commands and sends them once it's up;
  // replacing it would fail whatever another caller had already queued.
  if (redis && redis.status !== 'end') {
    return redis;
  }
  redis = null;

  // Get Redis connection details from environment variables
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL or REDIS_TLS_URL environment variable is required');
  }

  const useTls = redisUrl.startsWith('rediss://');
  // The server's certificate is verified unless this is set to 0. Only for a
  // provider that presents a certificate no public CA signed; without the
  // check, anything on the network path can pose as Redis.
  const verifyCertificate = process.env.REDIS_TLS_REJECT_UNAUTHORIZED !== '0';

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    // A frozen Lambda can thaw holding a dead socket. Fail the command rather
    // than hold the request until the Lambda's own 30-second timeout.
    connectTimeout: 5_000,
    commandTimeout: 5_000,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.error('Redis connection failed after 3 retries');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000); // Exponential backoff
    },
    ...(useTls && !verifyCertificate && { tls: { rejectUnauthorized: false } }),
  });

  // Surface connection errors; lifecycle events are otherwise silent.
  redis.on('error', (err: Error) => {
    console.error('Redis client error:', err);
  });

  return redis;
}

/**
 * Close Redis connection (for graceful shutdown)
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

/**
 * Check if Redis is available and connected
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = getRedisClient();
    await client.ping();
    return true;
  } catch (e) {
    console.error('Redis not available:', e);
    return false;
  }
}

// Export Redis instance for direct use if needed
export { redis };
