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
};

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));


describe('Daily Mode Integration Tests', () => {
  const testDate = '2024-01-15';
  const testUsername = 'integrationtest';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: SET NX succeeds (no duplicate)
    mockRedis.set.mockResolvedValue('OK');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Complete Daily Workflow', () => {
    it('should complete full daily puzzle workflow', async () => {
      // Step 1: Load daily puzzles
      const dailyPuzzles: DailyPuzzleSet = {
        date: testDate,
        puzzles: [
          { fen: 'fen1', eval: 100 },
          { fen: 'fen2', eval: -50 },
          { fen: 'fen3', eval: 200 },
          { fen: 'fen4', eval: -300 },
        ],
        seed: 20240115,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(dailyPuzzles));

      const puzzlesResponse = await puzzlesLoader(createLoaderArgs(`/api/chesserGuesser/puzzles?date=${testDate}`));
      expect(puzzlesResponse.status).toBe(200);
      const puzzlesData = await puzzlesResponse.json();
      expect(puzzlesData.puzzles).toHaveLength(4);

      // Step 2: Submit each puzzle
      const submissions = [
        { puzzleIndex: 0, guess: 95, actualEval: 100 },
        { puzzleIndex: 1, guess: -45, actualEval: -50 },
        { puzzleIndex: 2, guess: 210, actualEval: 200 },
        { puzzleIndex: 3, guess: -290, actualEval: -300 },
      ];

      const submittedPuzzles: any[] = [];
      for (let i = 0; i < submissions.length; i++) {
        const submission = submissions[i];
        mockRedis.get.mockClear();

        // Mock completed count
        mockRedis.get.mockResolvedValueOnce(String(i)); // Completed count

        // Mock all 4 puzzle submissions - return what's been submitted so far
        for (let j = 0; j < 4; j++) {
          if (j < i) {
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(submittedPuzzles[j]));
          } else {
            mockRedis.get.mockResolvedValueOnce(null);
          }
        }

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

        // Store the submission for future mocking
        submittedPuzzles.push({ score: result.score });

        if (i > 0) {
          expect(result.totalScore).toBeGreaterThan(0);
        }
      }

      // Step 3: Check leaderboard
      const finalTotalScore = submittedPuzzles.reduce((sum, p) => sum + p.score, 0);
      mockRedis.zrange.mockResolvedValue([testUsername, String(finalTotalScore)]);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.get.mockResolvedValueOnce('4').mockResolvedValueOnce(
        JSON.stringify({
          username: testUsername,
          totalScore: finalTotalScore,
          lastUpdated: Date.now(),
        })
      );

      const leaderboardResponse = await leaderboardLoader(createLoaderArgs(`/api/chesserGuesser/leaderboard?date=${testDate}`));
      const leaderboardData = await leaderboardResponse.json();

      expect(leaderboardData.leaderboard).toHaveLength(1);
      expect(leaderboardData.leaderboard[0].username).toBe(testUsername);
      expect(leaderboardData.leaderboard[0].score).toBe(finalTotalScore);
      expect(leaderboardData.leaderboard[0].completedPuzzles).toBe(4);
    });

    it('should handle partial completion', async () => {
      // Submit only 2 out of 4 puzzles
      const submissions = [
        { puzzleIndex: 0, guess: 100, actualEval: 100 },
        { puzzleIndex: 1, guess: -50, actualEval: -50 },
      ];

      const submittedPuzzles: any[] = [];
      for (let i = 0; i < submissions.length; i++) {
        const submission = submissions[i];
        mockRedis.get.mockClear();

        // Mock completed count
        mockRedis.get.mockResolvedValueOnce(String(i));

        // Mock all 4 puzzle submissions
        for (let j = 0; j < 4; j++) {
          if (j < i) {
            mockRedis.get.mockResolvedValueOnce(JSON.stringify(submittedPuzzles[j]));
          } else {
            mockRedis.get.mockResolvedValueOnce(null);
          }
        }

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
      mockRedis.get.mockResolvedValueOnce('2');

      const leaderboardResponse = await leaderboardLoader(createLoaderArgs(`/api/chesserGuesser/leaderboard?date=${testDate}`));
      const leaderboardData = await leaderboardResponse.json();

      expect(leaderboardData.leaderboard[0].completedPuzzles).toBe(2);
    });
  });

  describe('Multiple Users Competition', () => {
    it('should rank multiple users correctly', async () => {
      const users = [
        { username: 'alice', scores: [100, 95, 90, 85], total: 370 },
        { username: 'bob', scores: [90, 90, 90, 90], total: 360 },
        { username: 'charlie', scores: [100, 100, 50, 50], total: 300 },
      ];

      // All users submit their puzzles
      for (const user of users) {
        const submittedPuzzles: any[] = [];
        for (let i = 0; i < 4; i++) {
          mockRedis.get.mockClear();

          // Mock completed count
          mockRedis.get.mockResolvedValueOnce(String(i));

          // Mock all 4 puzzle submissions
          for (let j = 0; j < 4; j++) {
            if (j < i) {
              mockRedis.get.mockResolvedValueOnce(JSON.stringify(submittedPuzzles[j]));
            } else {
              mockRedis.get.mockResolvedValueOnce(null);
            }
          }

          const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: user.username,
              date: testDate,
              puzzleIndex: i,
              guess: 100,
              actualEval: 100,
            }),
          }));

          const result = await submitResponse.json();
          submittedPuzzles.push({ score: result.score });
        }
      }

      // Check leaderboard ranking
      const mockLeaderboardData = [
        'alice', '370',
        'bob', '360',
        'charlie', '300',
      ];

      mockRedis.zrange.mockResolvedValue(mockLeaderboardData);
      mockRedis.zcard.mockResolvedValue(3);
      mockRedis.get.mockResolvedValue('4');

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
        mockRedis.get.mockResolvedValueOnce('0') // completed = 0
          .mockResolvedValueOnce(null) // puzzle 0 doesn't exist yet
          .mockResolvedValueOnce(null) // puzzle 1 doesn't exist yet
          .mockResolvedValueOnce(null) // puzzle 2 doesn't exist yet
          .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

        const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date,
            puzzleIndex: 0,
            guess: 100,
            actualEval: 100,
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
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

      const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
        }),
      }));

      expect(submitResponse.status).toBe(500);
    });

    it('should prevent duplicate submissions', async () => {
      // First submission succeeds
      mockRedis.get.mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0');

      const response1 = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
        }),
      }));

      expect(response1.status).toBe(200);

      // Second submission fails (duplicate) - SET NX returns null
      mockRedis.get.mockClear();
      mockRedis.set.mockResolvedValue(null); // Key already exists

      const response2 = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
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

        // Mock completed count first
        mockRedis.get.mockResolvedValueOnce(String(i));

        // Use mockImplementation for subsequent get calls to handle totalScore calculation
        let getCallCount = 0;
        mockRedis.get.mockImplementation((key: string) => {
          getCallCount++;

          // The totalScore calculation loops through puzzles 0-3
          for (let j = 0; j <= i; j++) {
            if (key.includes(`:submission:`) && key.endsWith(`:${j}`)) {
              if (j < i) {
                // Previously submitted puzzle
                return Promise.resolve(JSON.stringify(submittedPuzzles[j]));
              } else if (j === i) {
                // Current puzzle - it was just stored, return a score
                return Promise.resolve(JSON.stringify({ score: 100 }));
              }
            }
          }
          return Promise.resolve(null);
        });

        const submitResponse = await submitAction(createActionArgs('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date: testDate,
            puzzleIndex: i,
            guess: 100,
            actualEval: 100,
          }),
        }));

        const result = await submitResponse.json();
        submittedPuzzles.push({ score: result.score });

        const expectedTotal = submittedPuzzles.reduce((sum, p) => sum + p.score, 0);
        expect(result.totalScore).toBe(expectedTotal);
      }
    });

    it('should update leaderboard after each submission', async () => {
      const mockScore = 95;
      mockRedis.get.mockResolvedValueOnce('3') // completed = 3 (this will be the 4th puzzle)
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 0
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 1
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 2
        .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

      await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
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
      mockRedis.get.mockResolvedValueOnce('3') // completed = 3 (this will be the 4th puzzle)
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 0
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 1
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 2
        .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

      await submitAction(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
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
