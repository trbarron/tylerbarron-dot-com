import { createLoaderArgs, createActionArgs } from '../setup';
/**
 * Tests for /api/chesserGuesser/submit route
 * Tests score submission, validation, and leaderboard updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { action } from '~/routes/api/chesserGuesser/submit';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn(),
};

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

describe('Submit Score API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: SET NX succeeds (no duplicate)
    mockRedis.set.mockResolvedValue('OK');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('action', () => {
    const validSubmission = {
      username: 'testuser123',
      date: '2024-01-15',
      puzzleIndex: 0,
      guess: 100,
      actualEval: 120,
    };

    const createRequestBody = (body: any, method: string = 'POST') => {
      return {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'GET' ? JSON.stringify(body) : undefined,
      };
    };

    it('should accept valid submission', async () => {
      // Mock completed count
      mockRedis.get.mockResolvedValueOnce('0'); // completed = 0

      // Mock reading back the 4 puzzle submissions for totalScore calculation
      // The current submission (puzzle 0) will have been stored by the time we calculate totalScore
      mockRedis.get.mockImplementation((key: string) => {
        if (key.includes(':submission:') && key.endsWith(':0')) {
          // This is the current submission - it exists now
          return Promise.resolve(JSON.stringify({ score: 95 }));
        }
        return Promise.resolve(null); // Other puzzles don't exist yet
      });

      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody(validSubmission)));

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.score).toBeGreaterThan(0);
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.puzzlesCompleted).toBe(1);
    });

    it('should reject duplicate submission', async () => {
      // Mock SET with NX returning null (key already exists)
      mockRedis.set.mockResolvedValue(null);

      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody(validSubmission)));

      expect(response.status).toBe(409);
      const result = await response.json();
      expect(result.error).toContain('already submitted this puzzle');
    });

    it('should reject invalid username formats', async () => {
      const invalidUsernames = [
        'this_username_is_way_too_long_for_validation', // Too long
        'user@name', // Invalid character
        'user name', // Space
        'user-name', // Dash
        '', // Empty
      ];

      for (const username of invalidUsernames) {
        mockRedis.get.mockClear();

        const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, username })));

        expect(response.status).toBe(400);
        const result = await response.json();
        expect(result.error).toContain('Invalid username');
      }
    });

    it('should accept valid username formats', async () => {
      const validUsernames = [
        'a', // Single character (min length)
        'ab', // Two characters
        'abc',
        'user123',
        'User_Name_123',
        'a'.repeat(20), // Max length
      ];

      for (const username of validUsernames) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValue('0'); // completed
        // Mock 4 puzzle submissions (all null - none exist yet)
        mockRedis.get.mockResolvedValue(null);

        const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, username })));

        expect(response.status).toBe(200);
      }
    });

    it('should reject invalid date format', async () => {
      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, date: '2024/01/15' })));

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toContain('Invalid date format');
    });

    it('should reject invalid puzzle index', async () => {
      const invalidIndices = [-1, 4, 10, 'invalid'];

      for (const puzzleIndex of invalidIndices) {
        const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, puzzleIndex })));

        expect(response.status).toBe(400);
      }
    });

    it('should accept valid puzzle indices (0-3)', async () => {
      for (let i = 0; i < 4; i++) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValue('0'); // completed
        // Mock 4 puzzle submissions (all null)
        mockRedis.get.mockResolvedValue(null);

        const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, puzzleIndex: i })));

        expect(response.status).toBe(200);
      }
    });

    it('should calculate score correctly', async () => {
      const testCases = [
        { guess: 100, actual: 100, expectedScore: 0 }, // Perfect (lower is better)
        { guess: 100, actual: 120, expectedScore: 20 }, // Close
        { guess: 100, actual: 0, expectedScore: 100 }, // Distance
        { guess: -100, actual: 100, expectedScore: 200 }, // Opposite side (distance of 200)
      ];

      for (const { guess, actual, expectedScore } of testCases) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValue('0'); // completed
        // Mock 4 puzzle submissions (all null)
        mockRedis.get.mockResolvedValue(null);

        const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, guess, actualEval: actual })));

        const result = await response.json();
        expect(result.score).toBeCloseTo(expectedScore, 0);
      }
    });

    it('should update total score correctly', async () => {
      // First submission (puzzle 0)
      mockRedis.get.mockResolvedValueOnce('0') // completed = 0
        .mockResolvedValueOnce(null) // puzzle 0 doesn't exist yet
        .mockResolvedValueOnce(null) // puzzle 1 doesn't exist yet
        .mockResolvedValueOnce(null) // puzzle 2 doesn't exist yet
        .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

      const response1 = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, puzzleIndex: 0 })));

      const result1 = await response1.json();
      const firstScore = result1.score;
      const firstTotalScore = result1.totalScore;

      // Second submission (puzzle 1) - now puzzle 0 exists
      mockRedis.get.mockClear();
      mockRedis.get.mockResolvedValueOnce('1') // completed = 1
        .mockResolvedValueOnce(JSON.stringify({ score: firstScore })) // puzzle 0 exists with its score
        .mockResolvedValueOnce(null) // puzzle 1 doesn't exist yet
        .mockResolvedValueOnce(null) // puzzle 2 doesn't exist yet
        .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

      const response2 = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, puzzleIndex: 1 })));

      const result2 = await response2.json();
      expect(result2.totalScore).toBeGreaterThan(firstTotalScore);
    });

    it('should update leaderboard', async () => {
      const mockScore = 95;
      mockRedis.get.mockResolvedValueOnce('3') // completed = 3 (this will be the 4th puzzle)
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 0
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 1
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 2
        .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet (this is the current submission)

      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody(validSubmission)));

      expect(response.status).toBe(200);
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'chesserGuesser:leaderboard:2024-01-15',
        expect.any(Number),
        'testuser123'
      );
    });

    it('should set TTL on all stored data', async () => {
      const mockScore = 95;
      mockRedis.get.mockResolvedValueOnce('3') // completed = 3 (this will be the 4th puzzle)
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 0
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 1
        .mockResolvedValueOnce(JSON.stringify({ score: mockScore })) // puzzle 2
        .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody(validSubmission)));
      expect(response.status).toBe(200);

      const TTL_7_DAYS = 7 * 24 * 60 * 60;

      // Check SET NX call has correct TTL
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        'EX',
        TTL_7_DAYS,
        'NX'
      );

      // Check all setex calls have correct TTL
      const setexCalls = mockRedis.setex.mock.calls;
      expect(setexCalls.length).toBeGreaterThan(0);
      setexCalls.forEach((call: any[]) => {
        expect(call[1]).toBe(TTL_7_DAYS);
      });

      // Check leaderboard expire
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'chesserGuesser:leaderboard:2024-01-15',
        TTL_7_DAYS
      );
    });

    it('should track puzzles completed', async () => {
      mockRedis.get.mockResolvedValueOnce('0') // completed = 0
        .mockResolvedValueOnce(null) // puzzle 0 doesn't exist yet
        .mockResolvedValueOnce(null) // puzzle 1 doesn't exist yet
        .mockResolvedValueOnce(null) // puzzle 2 doesn't exist yet
        .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody(validSubmission)));

      const result = await response.json();
      expect(result.puzzlesCompleted).toBe(1);

      // Verify it was stored
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `chesserGuesser:completed:2024-01-15:testuser123`,
        expect.any(Number),
        '1'
      );
    });

    it('should store submission data with timestamp', async () => {
      mockRedis.get.mockResolvedValueOnce('0') // completed = 0
        .mockResolvedValueOnce(null) // puzzle 0 doesn't exist yet
        .mockResolvedValueOnce(null) // puzzle 1 doesn't exist yet
        .mockResolvedValueOnce(null) // puzzle 2 doesn't exist yet
        .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

      const beforeTimestamp = Date.now();

      await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody(validSubmission)));

      const afterTimestamp = Date.now();

      // Check the SET call for submission data
      expect(mockRedis.set).toHaveBeenCalled();
      const setCall = mockRedis.set.mock.calls[0];
      const submissionData = JSON.parse(setCall[1]);
      expect(submissionData.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(submissionData.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should reject non-POST requests', async () => {
      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody(validSubmission, 'GET')));

      expect(response.status).toBe(405);
      const result = await response.json();
      expect(result.error).toContain('Method not allowed');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody(validSubmission)));

      expect(response.status).toBe(500);
      const result = await response.json();
      expect(result.error).toContain('Failed to submit');
    });
  });

  describe('Score Calculation Edge Cases', () => {
    const createRequest = (body: any, method: string = 'POST') => {
      return new Request('http://localhost/api/chesserGuesser/submit', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    };

    it('should handle zero evaluations correctly', async () => {
      mockRedis.get.mockResolvedValueOnce('0') // completed = 0
        .mockResolvedValueOnce(null) // puzzle 0 doesn't exist yet
        .mockResolvedValueOnce(null) // puzzle 1 doesn't exist yet
        .mockResolvedValueOnce(null) // puzzle 2 doesn't exist yet
        .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

      const response = await action(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          date: '2024-01-15',
          puzzleIndex: 0,
          guess: 0,
          actualEval: 0,
        }),
      }));

      const result = await response.json();
      expect(result.score).toBe(0); // Perfect guess (distance = 0)
    });

    it('should handle extreme evaluations', async () => {
      const extremeCases = [
        { guess: 400, actual: 400 },
        { guess: -400, actual: -400 },
        { guess: 400, actual: 350 },
      ];

      for (const { guess, actual } of extremeCases) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValueOnce('0') // completed = 0
          .mockResolvedValueOnce(null) // puzzle 0 doesn't exist yet
          .mockResolvedValueOnce(null) // puzzle 1 doesn't exist yet
          .mockResolvedValueOnce(null) // puzzle 2 doesn't exist yet
          .mockResolvedValueOnce(null); // puzzle 3 doesn't exist yet

        const response = await action(createActionArgs('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'testuser',
            date: '2024-01-15',
            puzzleIndex: 0,
            guess,
            actualEval: actual,
          }),
        }));

        const result = await response.json();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });
  });
});
