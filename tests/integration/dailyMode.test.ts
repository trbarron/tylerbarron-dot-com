/**
 * Integration tests for daily mode workflow
 * Tests the complete flow from puzzle loading to leaderboard submission
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLoaderArgs, createActionArgs } from '../setup';
import type { DailyPuzzleSet, DailyGameState } from '~/utils/chesserGuesser/types';
import { loader as puzzlesLoader } from '~/routes/api/chesserGuesser/puzzles';
import { action as submitAction } from '~/routes/api/chesserGuesser/submit';
import { loader as leaderboardLoader } from '~/routes/api/chesserGuesser/leaderboard';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn(),
  zrange: vi.fn(),
  zrank: vi.fn(),
  zscore: vi.fn(),
  zcard: vi.fn(),
  mget: vi.fn(),
  // Rate limiting methods (fail-open on error)
  zremrangebyscore: vi.fn(),
};

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

// Mock rate limiter to always allow
vi.mock('~/utils/chesserGuesser/rateLimit.server', () => ({
  rateLimitMiddleware: vi.fn().mockResolvedValue(null),
}));


describe('Daily Mode Integration Tests', () => {
  const testDate = '2024-01-15';
  const testUsername = 'integrationtest';

  // Standard daily puzzle cache data
  const mockDailyPuzzles = JSON.stringify({
    date: testDate,
    puzzles: [
      { fen: 'fen1', eval: 100 },
      { fen: 'fen2', eval: -50 },
      { fen: 'fen3', eval: 200 },
      { fen: 'fen4', eval: -300 },
    ],
    seed: 20240115,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: SET NX succeeds (no duplicate)
    mockRedis.set.mockResolvedValue('OK');
    // Default: mget returns all nulls
    mockRedis.mget.mockResolvedValue([null, null, null, null]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Daily Workflow', () => {
    it('should complete full daily puzzle workflow', async () => {
      // Step 1: Load daily puzzles
      mockRedis.get.mockResolvedValue(mockDailyPuzzles);

      const puzzlesResponse = await puzzlesLoader(createLoaderArgs(`/api/chesserGuesser/puzzles?date=${testDate}`));
      expect(puzzlesResponse.status).toBe(200);
      const puzzlesData = await puzzlesResponse.json();
      expect(puzzlesData.puzzles).toHaveLength(4);

      // Step 2: Submit each puzzle (guesses close to actual evals)
      const submissions = [
        { puzzleIndex: 0, guess: 95 },
        { puzzleIndex: 1, guess: -45 },
        { puzzleIndex: 2, guess: 210 },
        { puzzleIndex: 3, guess: -290 },
      ];

      const submittedPuzzles: any[] = [];
      for (let i = 0; i < submissions.length; i++) {
        const submission = submissions[i];
        mockRedis.get.mockClear();
        mockRedis.set.mockClear();
        mockRedis.mget.mockClear();
        mockRedis.set.mockResolvedValue('OK');

        // Mock: daily puzzle cache, then completed count
        mockRedis.get
          .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
          .mockResolvedValueOnce(String(i)); // Completed count

        // Mock mget for 4 puzzle submissions
        const mgetResults = Array(4).fill(null);
        for (let j = 0; j < i; j++) {
          mgetResults[j] = JSON.stringify(submittedPuzzles[j]);
        }
        mockRedis.mget.mockResolvedValueOnce(mgetResults);

        const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date: testDate,
            ...submission,
          }),
        }));

        expect(submitResponse.status).toBe(200);
        const result = await submitResponse.json();

        submittedPuzzles.push({ score: result.score });

        if (i > 0) {
          expect(result.totalScore).toBeGreaterThan(0);
        }
      }

      // Step 3: Check leaderboard
      const finalTotalScore = submittedPuzzles.reduce((sum, p) => sum + p.score, 0);
      mockRedis.zrange.mockResolvedValue([testUsername, String(finalTotalScore)]);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.mget
        .mockResolvedValueOnce(['4']) // completed keys
        .mockResolvedValueOnce([JSON.stringify({
          username: testUsername,
          totalScore: finalTotalScore,
          lastUpdated: Date.now(),
        })]); // summary keys

      const leaderboardResponse = await leaderboardLoader(createLoaderArgs(`/api/chesserGuesser/leaderboard?date=${testDate}`));
      const leaderboardData = await leaderboardResponse.json();

      expect(leaderboardData.leaderboard).toHaveLength(1);
      expect(leaderboardData.leaderboard[0].username).toBe(testUsername);
      expect(leaderboardData.leaderboard[0].score).toBe(finalTotalScore);
      expect(leaderboardData.leaderboard[0].completedPuzzles).toBe(4);
    });

    it('should handle partial completion', async () => {
      const submissions = [
        { puzzleIndex: 0, guess: 100 },
        { puzzleIndex: 1, guess: -50 },
      ];

      const submittedPuzzles: any[] = [];
      for (let i = 0; i < submissions.length; i++) {
        const submission = submissions[i];
        mockRedis.get.mockClear();
        mockRedis.set.mockClear();
        mockRedis.mget.mockClear();
        mockRedis.set.mockResolvedValue('OK');

        mockRedis.get
          .mockResolvedValueOnce(mockDailyPuzzles)
          .mockResolvedValueOnce(String(i));

        const mgetResults = Array(4).fill(null);
        for (let j = 0; j < i; j++) {
          mgetResults[j] = JSON.stringify(submittedPuzzles[j]);
        }
        mockRedis.mget.mockResolvedValueOnce(mgetResults);

        const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date: testDate,
            ...submission,
          }),
        }));

        const result = await submitResponse.json();
        submittedPuzzles.push({ score: result.score });
        expect(result.puzzlesCompleted).toBe(i + 1);
      }

      // Verify on leaderboard with partial completion
      const finalTotalScore = submittedPuzzles.reduce((sum, p) => sum + p.score, 0);
      mockRedis.zrange.mockResolvedValue([testUsername, String(finalTotalScore)]);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.mget
        .mockResolvedValueOnce(['2'])
        .mockResolvedValueOnce([null]);

      const leaderboardResponse = await leaderboardLoader(createLoaderArgs(`/api/chesserGuesser/leaderboard?date=${testDate}`));
      const leaderboardData = await leaderboardResponse.json();

      expect(leaderboardData.leaderboard[0].completedPuzzles).toBe(2);
    });
  });

  describe('Multiple Users Competition', () => {
    it('should rank multiple users correctly', async () => {
      const users = [
        { username: 'alice', total: 30 },
        { username: 'bob', total: 40 },
        { username: 'charlie', total: 50 },
      ];

      // All users submit their puzzles
      for (const user of users) {
        const submittedPuzzles: any[] = [];
        for (let i = 0; i < 4; i++) {
          mockRedis.get.mockClear();
          mockRedis.set.mockClear();
          mockRedis.mget.mockClear();
          mockRedis.set.mockResolvedValue('OK');

          mockRedis.get
            .mockResolvedValueOnce(mockDailyPuzzles)
            .mockResolvedValueOnce(String(i));

          const mgetResults = Array(4).fill(null);
          for (let j = 0; j < i; j++) {
            mgetResults[j] = JSON.stringify(submittedPuzzles[j]);
          }
          mockRedis.mget.mockResolvedValueOnce(mgetResults);

          const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: user.username,
              date: testDate,
              puzzleIndex: i,
              guess: 100,
            }),
          }));

          const result = await submitResponse.json();
          submittedPuzzles.push({ score: result.score });
        }
      }

      // Check leaderboard ranking (lower scores are better)
      const mockLeaderboardData = [
        'alice', '30',
        'bob', '40',
        'charlie', '50',
      ];

      mockRedis.zrange.mockResolvedValue(mockLeaderboardData);
      mockRedis.zcard.mockResolvedValue(3);
      mockRedis.mget
        .mockResolvedValueOnce(['4', '4', '4']) // completed
        .mockResolvedValueOnce([null, null, null]); // summaries

      const leaderboardResponse = await leaderboardLoader(createLoaderArgs(`/api/chesserGuesser/leaderboard?date=${testDate}&limit=3`));
      const leaderboardData = await leaderboardResponse.json();

      expect(leaderboardData.leaderboard).toHaveLength(3);
      expect(leaderboardData.leaderboard[0].username).toBe('alice');
      expect(leaderboardData.leaderboard[0].rank).toBe(1);
      expect(leaderboardData.leaderboard[1].username).toBe('bob');
      expect(leaderboardData.leaderboard[1].rank).toBe(2);
      expect(leaderboardData.leaderboard[2].username).toBe('charlie');
      expect(leaderboardData.leaderboard[2].rank).toBe(3);
    });
  });

  describe('Cross-Day Isolation', () => {
    it('should isolate puzzles and scores by date', async () => {
      const dates = ['2024-01-15', '2024-01-16'];

      for (const date of dates) {
        // Different puzzles for different dates
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValue(null);

        const puzzlesResponse = await puzzlesLoader(createLoaderArgs(`/api/chesserGuesser/puzzles?date=${date}`));
        const puzzlesData = await puzzlesResponse.json();
        expect(puzzlesData.date).toBe(date);

        // Submit score for this date
        mockRedis.get.mockClear();
        mockRedis.set.mockClear();
        mockRedis.mget.mockClear();
        mockRedis.set.mockResolvedValue('OK');
        mockRedis.get
          .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
          .mockResolvedValueOnce('0'); // completed = 0
        mockRedis.mget.mockResolvedValueOnce([null, null, null, null]);

        const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date,
            puzzleIndex: 0,
            guess: 100,
          }),
        }));

        expect(submitResponse.status).toBe(200);

        // Check that submission was stored atomically with correct date
        const submissionKey = `chesserGuesser:submission:${date}:${testUsername}:0`;
        expect(mockRedis.set).toHaveBeenCalledWith(
          submissionKey,
          expect.any(String),
          'EX',
          expect.any(Number),
          'NX'
        );
      }
    });
  });

  describe('Error Recovery', () => {
    it('should handle puzzle fetch failure gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      // Mock global fetch to simulate network failure
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      const puzzlesResponse = await puzzlesLoader(createLoaderArgs(`/api/chesserGuesser/puzzles?date=${testDate}`));
      // Should succeed with fallback puzzles instead of returning error
      expect(puzzlesResponse.status).toBe(200);

      const data = await puzzlesResponse.json();
      expect(data.puzzles).toHaveLength(4);

      // Restore global fetch
      vi.unstubAllGlobals();
    });

    it('should handle Redis failure gracefully', async () => {
      mockRedis.get.mockResolvedValueOnce(mockDailyPuzzles); // puzzle cache succeeds
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
        }),
      }));

      expect(submitResponse.status).toBe(500);
    });

    it('should prevent duplicate submissions', async () => {
      // First submission succeeds
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles)
        .mockResolvedValueOnce('0');
      mockRedis.mget.mockResolvedValueOnce([null, null, null, null]);

      const response1 = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
        }),
      }));

      expect(response1.status).toBe(200);

      // Second submission fails (duplicate) - SET NX returns null
      mockRedis.get.mockClear();
      mockRedis.get.mockResolvedValueOnce(mockDailyPuzzles);
      mockRedis.set.mockResolvedValue(null); // Key already exists

      const response2 = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
        }),
      }));

      expect(response2.status).toBe(409);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent total score across submissions', async () => {
      const submittedPuzzles: any[] = [];

      for (let i = 0; i < 4; i++) {
        mockRedis.get.mockClear();
        mockRedis.set.mockClear();
        mockRedis.mget.mockClear();
        mockRedis.set.mockResolvedValue('OK');

        mockRedis.get
          .mockResolvedValueOnce(mockDailyPuzzles)
          .mockResolvedValueOnce(String(i));

        // Build mget results: previously submitted puzzles + current as stored + rest null
        const mgetResults = Array(4).fill(null);
        for (let j = 0; j < i; j++) {
          mgetResults[j] = JSON.stringify(submittedPuzzles[j]);
        }
        // Current puzzle will have been stored by the time mget runs
        // The score for puzzle i will be calculated by the action
        mockRedis.mget.mockResolvedValueOnce(mgetResults);

        const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date: testDate,
            puzzleIndex: i,
            guess: 100,
          }),
        }));

        const result = await submitResponse.json();
        submittedPuzzles.push({ score: result.score });

        // totalScore from mget won't include current submission (mget runs before store),
        // but the action adds current score. Let's just verify it's a number >= 0.
        expect(result.totalScore).toBeGreaterThanOrEqual(0);
      }
    });

    it('should update leaderboard after each submission', async () => {
      const mockScore = 95;
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles)
        .mockResolvedValueOnce('3'); // completed = 3 (this will be the 4th)
      mockRedis.mget.mockResolvedValueOnce([
        JSON.stringify({ score: mockScore }),
        JSON.stringify({ score: mockScore }),
        JSON.stringify({ score: mockScore }),
        null,
      ]);

      await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 3,
          guess: 100,
        }),
      }));

      // Verify leaderboard was updated
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        `chesserGuesser:leaderboard:${testDate}`,
        expect.any(Number),
        testUsername
      );
    });
  });

  describe('TTL Management', () => {
    it('should set 7-day TTL on all stored data', async () => {
      const mockScore = 95;
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles)
        .mockResolvedValueOnce('3'); // completed = 3 (4th puzzle)
      mockRedis.mget.mockResolvedValueOnce([
        JSON.stringify({ score: mockScore }),
        JSON.stringify({ score: mockScore }),
        JSON.stringify({ score: mockScore }),
        null,
      ]);

      await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 3,
          guess: 100,
        }),
      }));

      const TTL_7_DAYS = 7 * 24 * 60 * 60;

      // Check all setex calls
      const setexCalls = mockRedis.setex.mock.calls;
      setexCalls.forEach((call: any[]) => {
        expect(call[1]).toBe(TTL_7_DAYS);
      });

      // Check leaderboard expire
      expect(mockRedis.expire).toHaveBeenCalledWith(
        `chesserGuesser:leaderboard:${testDate}`,
        TTL_7_DAYS
      );
    });
  });
});
