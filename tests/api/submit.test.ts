/**
 * Tests for /api/chesserGuesser/submit route
 * Tests score submission, validation, and leaderboard updates
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { action } from '~/routes/api/chesserGuesser/submit';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
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

    const createRequest = (body: any, method: string = 'POST') => {
      return new Request('http://localhost/api/chesserGuesser/submit', {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'GET' ? JSON.stringify(body) : undefined,
      });
    };

    it('should accept valid submission', async () => {
      mockRedis.get.mockResolvedValue(null); // No existing submission
      mockRedis.get.mockResolvedValueOnce(null).mockResolvedValueOnce('0'); // userScore, completed

      const request = createRequest(validSubmission);
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(200); // Response objects in tests might not have status property directly accessible if it's a native Response, but assert response.json().
      // Actually action returns Response.json(), which is a standard Response.

      const result = await response.json();
      expect(result.success).toBe(true);
      expect(result.score).toBeGreaterThan(0);
      expect(result.totalScore).toBeGreaterThan(0);
      expect(result.puzzlesCompleted).toBe(1);
    });

    it('should reject duplicate submission', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({
        username: 'testuser123',
        date: '2024-01-15',
        puzzleIndex: 0,
        guess: 100,
        actualEval: 120,
        score: 95,
        timestamp: Date.now(),
      }));

      const request = createRequest(validSubmission);
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(409);
      const result = await response.json();
      expect(result.error).toContain('already submitted');
    });

    it('should reject invalid username formats', async () => {
      const invalidUsernames = [
        'ab', // Too short
        'this_username_is_way_too_long_for_validation', // Too long
        'user@name', // Invalid character
        'user name', // Space
        'user-name', // Dash
        '123', // Valid but edge case (should pass)
        '',
      ];

      for (const username of invalidUsernames.slice(0, -1)) {
        const request = createRequest({ ...validSubmission, username });
        const response = await action({ request, params: {}, context: {} } as any);


        if (username === '123') {
          expect(response.status).toBe(200);
        } else {
          expect(response.status).toBe(400);
          const result = await response.json();
          expect(result.error).toContain('Invalid username');
        }
      }
    });

    it('should accept valid username formats', async () => {
      mockRedis.get.mockResolvedValue(null);

      const validUsernames = [
        'abc', // Min length
        'user123',
        'User_Name_123',
        'a'.repeat(20), // Max length
      ];

      for (const username of validUsernames) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValue(null);

        const request = createRequest({ ...validSubmission, username });
        const response = await action({ request, params: {}, context: {} } as any);

        expect(response.status).toBe(200);
      }
    });

    it('should reject invalid date format', async () => {
      const request = createRequest({ ...validSubmission, date: '2024/01/15' });
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result.error).toContain('Invalid date format');
    });

    it('should reject invalid puzzle index', async () => {
      const invalidIndices = [-1, 4, 10, 'invalid'];

      for (const puzzleIndex of invalidIndices) {
        const request = createRequest({ ...validSubmission, puzzleIndex });
        const response = await action({ request, params: {}, context: {} } as any);

        expect(response.status).toBe(400);
      }
    });

    it('should accept valid puzzle indices (0-3)', async () => {
      mockRedis.get.mockResolvedValue(null);

      for (let i = 0; i < 4; i++) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValue(null);

        const request = createRequest({ ...validSubmission, puzzleIndex: i });
        const response = await action({ request, params: {}, context: {} } as any);

        expect(response.status).toBe(200);
      }
    });

    it('should calculate score correctly', async () => {
      mockRedis.get.mockResolvedValue(null);

      const testCases = [
        { guess: 100, actual: 100, expectedScore: 100 }, // Perfect
        { guess: 100, actual: 120, expectedScore: 95 }, // Close
        { guess: 100, actual: 0, expectedScore: 0 }, // Wrong side
        { guess: -100, actual: 100, expectedScore: 0 }, // Opposite side
      ];

      for (const { guess, actual, expectedScore } of testCases) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValue(null);

        const request = createRequest({ ...validSubmission, guess, actualEval: actual });
        const response = await action({ request, params: {}, context: {} } as any);

        const result = await response.json();
        expect(result.score).toBeCloseTo(expectedScore, 0);
      }
    });

    it('should update total score correctly', async () => {
      // First submission
      mockRedis.get.mockResolvedValueOnce(null) // No existing submission
        .mockResolvedValueOnce('0') // userScore = 0
        .mockResolvedValueOnce('0'); // completed = 0

      const request1 = createRequest({ ...validSubmission, puzzleIndex: 0 });
      const response1 = await action({ request: request1, params: {}, context: {} });

      const result1 = await response1.json();
      const firstScore = result1.totalScore;

      // Second submission
      mockRedis.get.mockClear();
      mockRedis.get.mockResolvedValueOnce(null) // No existing submission
        .mockResolvedValueOnce(String(firstScore)) // Previous score
        .mockResolvedValueOnce('1'); // completed = 1

      const request2 = createRequest({ ...validSubmission, puzzleIndex: 1 });
      const response2 = await action({ request: request2, params: {}, context: {} });

      const result2 = await response2.json();
      expect(result2.totalScore).toBeGreaterThan(firstScore);
    });

    it('should update leaderboard', async () => {
      mockRedis.get.mockResolvedValue(null);

      const request = createRequest(validSubmission);
      await action({ request, params: {}, context: {} });

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'chesserGuesser:leaderboard:2024-01-15',
        expect.any(Number),
        'testuser123'
      );
    });

    it('should set TTL on all stored data', async () => {
      mockRedis.get.mockResolvedValue(null);

      const request = createRequest(validSubmission);
      await action({ request, params: {}, context: {} });

      const TTL_30_DAYS = 30 * 24 * 60 * 60;

      // Check all setex calls have correct TTL
      const setexCalls = mockRedis.setex.mock.calls;
      expect(setexCalls.length).toBeGreaterThan(0);
      setexCalls.forEach((call: any[]) => {
        expect(call[1]).toBe(TTL_30_DAYS);
      });

      // Check leaderboard expire
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'chesserGuesser:leaderboard:2024-01-15',
        TTL_30_DAYS
      );
    });

    it('should track puzzles completed', async () => {
      mockRedis.get.mockResolvedValue(null);

      const request = createRequest(validSubmission);
      const response = await action({ request, params: {}, context: {} } as any);

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
      mockRedis.get.mockResolvedValue(null);

      const beforeTimestamp = Date.now();

      const request = createRequest(validSubmission);
      await action({ request, params: {}, context: {} });

      const afterTimestamp = Date.now();

      const submissionCall = mockRedis.setex.mock.calls.find((call: any[]) =>
        call[0].includes('submission')
      );

      expect(submissionCall).toBeDefined();
      const submissionData = JSON.parse(submissionCall![2]);
      expect(submissionData.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(submissionData.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });

    it('should reject non-POST requests', async () => {
      const request = createRequest(validSubmission, 'GET');
      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.status).toBe(405);
      const result = await response.json();
      expect(result.error).toContain('Method not allowed');
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const request = createRequest(validSubmission);
      const response = await action({ request, params: {}, context: {} } as any);

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
      mockRedis.get.mockResolvedValue(null);

      const request = createRequest({
        username: 'testuser',
        date: '2024-01-15',
        puzzleIndex: 0,
        guess: 0,
        actualEval: 0,
      });
      const response = await action({ request, params: {}, context: {} } as any);

      const result = await response.json();
      expect(result.score).toBe(100); // Perfect equal position
    });

    it('should handle extreme evaluations', async () => {
      mockRedis.get.mockResolvedValue(null);

      const extremeCases = [
        { guess: 400, actual: 400 },
        { guess: -400, actual: -400 },
        { guess: 400, actual: 350 },
      ];

      for (const { guess, actual } of extremeCases) {
        mockRedis.get.mockClear();
        mockRedis.get.mockResolvedValue(null);

        const request = createRequest({
          username: 'testuser',
          date: '2024-01-15',
          puzzleIndex: 0,
          guess,
          actualEval: actual,
        });
        const response = await action({ request, params: {}, context: {} } as any);

        const result = await response.json();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });
  });
});
