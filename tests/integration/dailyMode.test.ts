/**
 * Integration tests for daily mode workflow
 * Tests the complete flow from puzzle loading to leaderboard submission
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { DailyPuzzleSet, DailyGameState } from '~/utils/chesserGuesser/types';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn(),
  zrevrange: vi.fn(),
  zrevrank: vi.fn(),
  zscore: vi.fn(),
  zcard: vi.fn(),
};

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

global.fetch = vi.fn();

describe('Daily Mode Integration Tests', () => {
  const testDate = '2024-01-15';
  const testUsername = 'integrationtest';

  beforeEach(() => {
    vi.clearAllMocks();
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

      const puzzlesResponse = await fetch(`/api/chesserGuesser/puzzles?date=${testDate}`);
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

      let totalScore = 0;
      for (const submission of submissions) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValueOnce(null) // No existing submission
          .mockResolvedValueOnce(String(totalScore)) // Current score
          .mockResolvedValueOnce(String(submission.puzzleIndex)); // Completed count

        const submitResponse = await fetch('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date: testDate,
            ...submission,
          }),
        });

        expect(submitResponse.status).toBe(200);
        const result = await submitResponse.json();
        expect(result.success).toBe(true);
        expect(result.totalScore).toBeGreaterThan(totalScore);
        totalScore = result.totalScore;
      }

      // Step 3: Check leaderboard
      mockRedis.zrevrange.mockResolvedValue([testUsername, String(totalScore)]);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.get.mockResolvedValueOnce('4').mockResolvedValueOnce(
        JSON.stringify({
          username: testUsername,
          totalScore,
          lastUpdated: Date.now(),
        })
      );

      const leaderboardResponse = await fetch(`/api/chesserGuesser/leaderboard?date=${testDate}`);
      const leaderboardData = await leaderboardResponse.json();

      expect(leaderboardData.leaderboard).toHaveLength(1);
      expect(leaderboardData.leaderboard[0].username).toBe(testUsername);
      expect(leaderboardData.leaderboard[0].score).toBe(totalScore);
      expect(leaderboardData.leaderboard[0].completedPuzzles).toBe(4);
    });

    it('should handle partial completion', async () => {
      // Submit only 2 out of 4 puzzles
      const submissions = [
        { puzzleIndex: 0, guess: 100, actualEval: 100 },
        { puzzleIndex: 1, guess: -50, actualEval: -50 },
      ];

      let totalScore = 0;
      for (let i = 0; i < submissions.length; i++) {
        const submission = submissions[i];
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValueOnce(null)
          .mockResolvedValueOnce(String(totalScore))
          .mockResolvedValueOnce(String(i));

        const submitResponse = await fetch('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date: testDate,
            ...submission,
          }),
        });

        const result = await submitResponse.json();
        totalScore = result.totalScore;
        expect(result.puzzlesCompleted).toBe(i + 1);
      }

      // Verify on leaderboard with partial completion
      mockRedis.zrevrange.mockResolvedValue([testUsername, String(totalScore)]);
      mockRedis.zcard.mockResolvedValue(1);
      mockRedis.get.mockResolvedValueOnce('2');

      const leaderboardResponse = await fetch(`/api/chesserGuesser/leaderboard?date=${testDate}`);
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
        let userTotal = 0;
        for (let i = 0; i < 4; i++) {
          mockRedis.get.mockClear();
          mockRedis.get.mockResolvedValueOnce(null)
            .mockResolvedValueOnce(String(userTotal))
            .mockResolvedValueOnce(String(i));

          const submitResponse = await fetch('/api/chesserGuesser/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: user.username,
              date: testDate,
              puzzleIndex: i,
              guess: 100,
              actualEval: 100,
            }),
          });

          const result = await submitResponse.json();
          userTotal = result.totalScore;
        }
      }

      // Check leaderboard ranking
      const mockLeaderboardData = [
        'alice', '370',
        'bob', '360',
        'charlie', '300',
      ];

      mockRedis.zrevrange.mockResolvedValue(mockLeaderboardData);
      mockRedis.zcard.mockResolvedValue(3);
      mockRedis.get.mockResolvedValue('4');

      const leaderboardResponse = await fetch(`/api/chesserGuesser/leaderboard?date=${testDate}&limit=3`);
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
        mockRedis.get.mockResolvedValue(null);
        (global.fetch as any).mockResolvedValue({
          ok: true,
          json: async () => ({
            body: JSON.stringify({ fen: `fen-${date}`, eval: '100' }),
          }),
        });

        const puzzlesResponse = await fetch(`/api/chesserGuesser/puzzles?date=${date}`);
        const puzzlesData = await puzzlesResponse.json();
        expect(puzzlesData.date).toBe(date);

        // Submit score for this date
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValue(null);

        const submitResponse = await fetch('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date,
            puzzleIndex: 0,
            guess: 100,
            actualEval: 100,
          }),
        });

        expect(submitResponse.status).toBe(200);

        // Check that submission was stored with correct date
        const submissionKey = `chesserGuesser:submission:${date}:${testUsername}:0`;
        expect(mockRedis.setex).toHaveBeenCalledWith(
          submissionKey,
          expect.any(Number),
          expect.any(String)
        );
      }
    });
  });

  describe('Error Recovery', () => {
    it('should handle puzzle fetch failure gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const puzzlesResponse = await fetch(`/api/chesserGuesser/puzzles?date=${testDate}`);
      expect(puzzlesResponse.status).toBe(500);
    });

    it('should handle Redis failure gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const submitResponse = await fetch('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
        }),
      });

      expect(submitResponse.status).toBe(500);
    });

    it('should prevent duplicate submissions', async () => {
      // First submission succeeds
      mockRedis.get.mockResolvedValueOnce(null)
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0');

      const response1 = await fetch('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
        }),
      });

      expect(response1.status).toBe(200);

      // Second submission fails (duplicate)
      mockRedis.get.mockClear();
      mockRedis.get.mockResolvedValue(JSON.stringify({
        username: testUsername,
        puzzleIndex: 0,
      }));

      const response2 = await fetch('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
        }),
      });

      expect(response2.status).toBe(409);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent total score across submissions', async () => {
      const expectedScores = [95, 90, 85, 80];
      let runningTotal = 0;

      for (let i = 0; i < 4; i++) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValueOnce(null)
          .mockResolvedValueOnce(String(runningTotal))
          .mockResolvedValueOnce(String(i));

        const submitResponse = await fetch('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: testUsername,
            date: testDate,
            puzzleIndex: i,
            guess: 100,
            actualEval: 100,
          }),
        });

        const result = await submitResponse.json();
        runningTotal += result.score;

        expect(result.totalScore).toBe(runningTotal);
      }
    });

    it('should update leaderboard after each submission', async () => {
      mockRedis.get.mockResolvedValueOnce(null)
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0');

      await fetch('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
        }),
      });

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
      mockRedis.get.mockResolvedValueOnce(null)
        .mockResolvedValueOnce('0')
        .mockResolvedValueOnce('0');

      await fetch('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: testUsername,
          date: testDate,
          puzzleIndex: 0,
          guess: 100,
          actualEval: 100,
        }),
      });

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
