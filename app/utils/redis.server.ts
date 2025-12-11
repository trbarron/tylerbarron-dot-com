// Redis client configuration for server-side use
// Connects to the same Redis instance used by Collaborative Checkmate

import Redis from 'ioredis';

let redis: Redis | null = null;

/**
 * Get or create Redis client instance
 * Uses singleton pattern to reuse connection across requests
 */
export function getRedisClient(): Redis {
  if (redis && redis.status === 'ready') {
    return redis;
  }

  // Get Redis connection details from environment variables
  // These should match the Collaborative Checkmate server configuration
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_TLS_URL;

  if (!redisUrl) {
    throw new Error('REDIS_URL or REDIS_TLS_URL environment variable is required');
  }

  // Parse Redis URL to check if TLS is needed
  const useTls = redisUrl.startsWith('rediss://');

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times: number) => {
      if (times > 3) {
        console.error('Redis connection failed after 3 retries');
        return null; // Stop retrying
      }
      return Math.min(times * 100, 3000); // Exponential backoff
    },
    ...(useTls && {
      tls: {
        rejectUnauthorized: false, // Required for some Redis providers
      },
    }),
  });

  // Handle connection events
  redis.on('connect', () => {
    console.log('Redis client connected');
  });

  redis.on('ready', () => {
    console.log('Redis client ready');
  });

  redis.on('error', (err: Error) => {
    console.error('Redis client error:', err);
  });

  redis.on('close', () => {
    console.log('Redis client disconnected');
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
