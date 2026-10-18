// The lobby list of games waiting for players, shared by the multiplayer
// games: a Redis sorted set of game ids scored by when they opened.

import { getRedisClient } from '~/utils/redis.server';

export function openGames(key: string, maxAgeMs: number) {
  return {
    async add(gameId: string, openedAt = Date.now()): Promise<void> {
      await getRedisClient().zadd(key, openedAt, gameId);
    },

    async remove(gameId: string): Promise<void> {
      await getRedisClient().zrem(key, gameId);
    },

    /**
     * Newest first. `describe` returns what the lobby shows for a game, or null
     * once it's no longer open (full, started, expired), which drops it from
     * the list. Entries older than `maxAgeMs` are dropped without asking.
     */
    async list<T>(describe: (gameId: string, openedAt: number) => Promise<T | null>): Promise<T[]> {
      const redis = getRedisClient();
      await redis.zremrangebyscore(key, '-inf', Date.now() - maxAgeMs);
      const entries = await redis.zrevrange(key, 0, -1, 'WITHSCORES');
      const games: T[] = [];
      for (let i = 0; i < entries.length; i += 2) {
        const game = await describe(entries[i], Number(entries[i + 1]));
        if (game) games.push(game);
        else await redis.zrem(key, entries[i]);
      }
      return games;
    },
  };
}
