import { createLoaderArgs, createActionArgs } from '../setup';
/**
 * Tests for /api/chesserGuesser/leaderboard route
 * Tests leaderboard retrieval, ranking, and filtering
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { LeaderboardEntry } from '~/utils/chesserGuesser/types';
import { loader } from '~/routes/api/chesserGuesser/leaderboard';

// Mock Redis
const mockRedis = {
  zrange: vi.fn(),
  zrank: vi.fn(),
  zscore: vi.fn(),
  zcard: vi.fn(),
  get: vi.fn(),
};

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

// Helper to create a mock request
function createRequest(url: string): Request {
  return new Request(`http://localhost${url}`);
}

describe('Leaderboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/chesserGuesser/leaderboard', () => {
    it('should return top 50 users by default', async () => {
      const mockLeaderboardData = Array.from({ length: 50 }, (_, i) => [
        `user${i}`,
        String(i * 5), // Lower scores are better
      ]).flat();

      mockRedis.zrange.mockResolvedValue(mockLeaderboardData);
      mockRedis.zcard.mockResolvedValue(100);
      mockRedis.get.mockResolvedValue(null);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard).toHaveLength(50);
      expect(data.totalPlayers).toBe(100);
      expect(mockRedis.zrange).toHaveBeenCalledWith(
        'chesserGuesser:leaderboard:2024-01-15',
        0,
        49,
        'WITHSCORES'
      );
    });

    it('should respect custom limit parameter', async () => {
      const mockLeaderboardData = Array.from({ length: 10 }, (_, i) => [
        `user${i}`,
        String(400 - i * 10),
      ]).flat();

      mockRedis.zrange.mockResolvedValue(mockLeaderboardData);
      mockRedis.zcard.mockResolvedValue(50);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=10';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard).toHaveLength(10);
      expect(mockRedis.zrange).toHaveBeenCalledWith(
        'chesserGuesser:leaderboard:2024-01-15',
        0,
        9,
        'WITHSCORES'
      );
    });

    it('should enforce maximum limit of 100', async () => {
      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=200';
      const response = await loader(createLoaderArgs(url));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid limit');
    });

    it('should enforce minimum limit of 1', async () => {
      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=0';
      const response = await loader(createLoaderArgs(url));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid limit');
    });

    it('should calculate ranks correctly', async () => {
      const mockLeaderboardData = [
        'alice', '400',
        'bob', '395',
        'charlie', '390',
      ];

      mockRedis.zrange.mockResolvedValue(mockLeaderboardData);
      mockRedis.zcard.mockResolvedValue(3);
      mockRedis.get.mockResolvedValue(null);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=3';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard[0].rank).toBe(1);
      expect(data.leaderboard[0].username).toBe('alice');
      expect(data.leaderboard[0].score).toBe(400);

      expect(data.leaderboard[1].rank).toBe(2);
      expect(data.leaderboard[1].username).toBe('bob');
      expect(data.leaderboard[1].score).toBe(395);

      expect(data.leaderboard[2].rank).toBe(3);
      expect(data.leaderboard[2].username).toBe('charlie');
      expect(data.leaderboard[2].score).toBe(390);
    });

    it('should include user rank even if outside top N', async () => {
      const mockLeaderboardData = Array.from({ length: 50 }, (_, i) => [
        `user${i}`,
        String(400 - i * 5),
      ]).flat();

      mockRedis.zrange.mockResolvedValue(mockLeaderboardData);
      mockRedis.zrank.mockResolvedValue(75); // User is rank 76
      mockRedis.zscore.mockResolvedValue('200');
      mockRedis.zcard.mockResolvedValue(100);
      mockRedis.get.mockResolvedValue('4').mockResolvedValueOnce('4').mockResolvedValueOnce(
        JSON.stringify({
          username: 'myuser',
          totalScore: 200,
          lastUpdated: Date.now(),
        })
      );

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&username=myuser';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.userRank).toBeDefined();
      expect(data.userRank.rank).toBe(76);
      expect(data.userRank.username).toBe('myuser');
      expect(data.userRank.score).toBe(200);
    });

    it('should not include userRank if user in top N', async () => {
      const mockLeaderboardData = [
        'myuser', '400',
        'user2', '395',
      ];

      mockRedis.zrange.mockResolvedValue(mockLeaderboardData);
      mockRedis.zrank.mockResolvedValue(0); // User is rank 1
      mockRedis.zcard.mockResolvedValue(10);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&username=myuser';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.userRank).toBeNull();
      expect(data.leaderboard[0].username).toBe('myuser');
    });

    it('should handle user not on leaderboard', async () => {
      mockRedis.zrange.mockResolvedValue([]);
      mockRedis.zrank.mockResolvedValue(null); // User not found
      mockRedis.zcard.mockResolvedValue(0);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&username=nonexistent';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.userRank).toBeNull();
      expect(data.leaderboard).toHaveLength(0);
      expect(data.totalPlayers).toBe(0);
    });

    it('should include completed puzzles count', async () => {
      mockRedis.zrange.mockResolvedValue(['alice', '400']);
      mockRedis.get.mockResolvedValue('4'); // Completed 4 puzzles
      mockRedis.zcard.mockResolvedValue(1);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=1';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard[0].completedPuzzles).toBe(4);
    });

    it('should include timestamp from summary', async () => {
      const testTimestamp = Date.now();
      mockRedis.zrange.mockResolvedValue(['alice', '400']);
      mockRedis.get.mockResolvedValueOnce('4').mockResolvedValueOnce(
        JSON.stringify({
          username: 'alice',
          totalScore: 400,
          lastUpdated: testTimestamp,
        })
      );
      mockRedis.zcard.mockResolvedValue(1);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=1';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard[0].timestamp).toBe(testTimestamp);
    });

    it('should use today\'s date if no date parameter', async () => {
      const today = new Date();
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      mockRedis.zrange.mockResolvedValue([]);
      mockRedis.zcard.mockResolvedValue(0);

      const url = '/api/chesserGuesser/leaderboard';
      const response = await loader(createLoaderArgs(url));

      expect(mockRedis.zrange).toHaveBeenCalledWith(
        `chesserGuesser:leaderboard:${expectedDate}`,
        0,
        49,
        'WITHSCORES'
      );
    });

    it('should reject invalid date format', async () => {
      const url = '/api/chesserGuesser/leaderboard?date=2024/01/15';
      const response = await loader(createLoaderArgs(url));

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid date format');
    });

    it('should set cache headers', async () => {
      mockRedis.zrange.mockResolvedValue([]);
      mockRedis.zcard.mockResolvedValue(0);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15';
      const response = await loader(createLoaderArgs(url));

      expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    });

    it('should handle empty leaderboard', async () => {
      mockRedis.zrange.mockResolvedValue([]);
      mockRedis.zcard.mockResolvedValue(0);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard).toHaveLength(0);
      expect(data.totalPlayers).toBe(0);
      expect(data.userRank).toBeNull();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.zrange.mockRejectedValue(new Error('Redis connection failed'));

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15';
      const response = await loader(createLoaderArgs(url));

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to fetch leaderboard');
    });
  });

  describe('Leaderboard Sorting', () => {
    it('should sort by score descending', async () => {
      const mockData = [
        'alice', '400',
        'bob', '350',
        'charlie', '300',
      ];

      mockRedis.zrange.mockResolvedValue(mockData);
      mockRedis.zcard.mockResolvedValue(3);
      mockRedis.get.mockResolvedValue(null);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=3';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard[0].score).toBeGreaterThanOrEqual(data.leaderboard[1].score);
      expect(data.leaderboard[1].score).toBeGreaterThanOrEqual(data.leaderboard[2].score);
    });

    it('should handle tied scores', async () => {
      const mockData = [
        'alice', '400',
        'bob', '400',
        'charlie', '350',
      ];

      mockRedis.zrange.mockResolvedValue(mockData);
      mockRedis.zcard.mockResolvedValue(3);
      mockRedis.get.mockResolvedValue(null);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=3';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard[0].score).toBe(400);
      expect(data.leaderboard[1].score).toBe(400);
      expect(data.leaderboard[0].rank).toBe(1);
      expect(data.leaderboard[1].rank).toBe(2); // Redis maintains order
    });
  });

  describe('Leaderboard Data Integrity', () => {
    it('should handle missing completed count gracefully', async () => {
      mockRedis.zrange.mockResolvedValue(['alice', '400']);
      mockRedis.get.mockResolvedValue(null); // No completed count
      mockRedis.zcard.mockResolvedValue(1);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=1';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard[0].completedPuzzles).toBe(0);
    });

    it('should handle missing summary gracefully', async () => {
      mockRedis.zrange.mockResolvedValue(['alice', '400']);
      mockRedis.get.mockResolvedValueOnce('4').mockResolvedValueOnce(null); // No summary
      mockRedis.zcard.mockResolvedValue(1);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15&limit=1';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.leaderboard[0].timestamp).toBe(0);
    });

    it('should include date in response', async () => {
      mockRedis.zrange.mockResolvedValue([]);
      mockRedis.zcard.mockResolvedValue(0);

      const url = '/api/chesserGuesser/leaderboard?date=2024-01-15';
      const response = await loader(createLoaderArgs(url));
      const data = await response.json();

      expect(data.date).toBe('2024-01-15');
    });
  });
});
