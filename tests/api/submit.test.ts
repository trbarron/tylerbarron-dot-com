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
  mget: vi.fn(),
  // Rate limiting methods (fail-open on error, so just stub them)
  zremrangebyscore: vi.fn(),
  zcard: vi.fn(),
  zrange: vi.fn(),
};

// Standard daily puzzle cache data used by most tests
const mockDailyPuzzles = JSON.stringify({
  date: '2024-01-15',
  puzzles: [
    { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', eval: 120 },
    { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', eval: 50 },
    { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', eval: -80 },
    { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', eval: 200 },
  ],
  seed: 20240115,
});

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

// Mock rate limiter to always allow
vi.mock('~/utils/chesserGuesser/rateLimit.server', () => ({
  rateLimitMiddleware: vi.fn().mockResolvedValue(null),
}));

describe('Submit Score API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: SET NX succeeds (no duplicate)
    mockRedis.set.mockResolvedValue('OK');
    // Default: mget returns all nulls (no existing puzzle submissions)
    mockRedis.mget.mockResolvedValue([null, null, null, null]);
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
      // Mock: puzzle cache, then completed count
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
        .mockResolvedValueOnce('0'); // completed = 0

      // Mock mget for 4 puzzle submissions (current submission stored, others null)
      mockRedis.mget.mockResolvedValueOnce([JSON.stringify({ score: 20 }), null, null, null]);

      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody(validSubmission)));

      expect(response.status).toBe(200);

      const result = await response.json();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.puzzlesCompleted).toBe(1);
    });

    it('should reject duplicate submission', async () => {
      mockRedis.get.mockResolvedValueOnce(mockDailyPuzzles); // daily puzzle cache
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
        mockRedis.set.mockClear();
        mockRedis.mget.mockClear();
        mockRedis.set.mockResolvedValue('OK');
        mockRedis.get
          .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
          .mockResolvedValueOnce('0'); // completed
        mockRedis.mget.mockResolvedValue([null, null, null, null]);

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
        mockRedis.set.mockClear();
        mockRedis.mget.mockClear();
        mockRedis.set.mockResolvedValue('OK');
        mockRedis.get
          .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
          .mockResolvedValueOnce('0'); // completed
        mockRedis.mget.mockResolvedValue([null, null, null, null]);

        const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, puzzleIndex: i })));

        expect(response.status).toBe(200);
      }
    });

    it('should calculate score correctly', async () => {
      // actualEval is now looked up from Redis, so we test with the eval from puzzle 0 (120)
      const puzzleEval = 120;
      const testCases = [
        { guess: 120, expectedScore: 0 }, // Perfect (lower is better)
        { guess: 100, expectedScore: 20 }, // Close
        { guess: 0, expectedScore: 120 }, // Distance
        { guess: -80, expectedScore: 200 }, // Opposite side
      ];

      for (const { guess, expectedScore } of testCases) {
        mockRedis.get.mockClear();
        mockRedis.set.mockClear();
        mockRedis.mget.mockClear();
        mockRedis.set.mockResolvedValue('OK');
        mockRedis.get
          .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache (puzzle 0 eval = 120)
          .mockResolvedValueOnce('0'); // completed
        mockRedis.mget.mockResolvedValue([null, null, null, null]);

        const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, guess })));

        const result = await response.json();
        expect(result.score).toBeCloseTo(expectedScore, 0);
      }
    });

    it('should update total score correctly', async () => {
      // First submission (puzzle 0)
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
        .mockResolvedValueOnce('0'); // completed = 0
      mockRedis.mget.mockResolvedValueOnce([null, null, null, null]);

      const response1 = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, puzzleIndex: 0 })));

      const result1 = await response1.json();
      const firstScore = result1.score;
      const firstTotalScore = result1.totalScore;

      // Second submission (puzzle 1) - now puzzle 0 exists
      mockRedis.get.mockClear();
      mockRedis.set.mockClear();
      mockRedis.mget.mockClear();
      mockRedis.set.mockResolvedValue('OK');
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
        .mockResolvedValueOnce('1'); // completed = 1
      mockRedis.mget.mockResolvedValueOnce([JSON.stringify({ score: firstScore }), null, null, null]);

      const response2 = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, puzzleIndex: 1 })));

      const result2 = await response2.json();
      expect(result2.totalScore).toBeGreaterThan(firstTotalScore);
    });

    it('should update leaderboard', async () => {
      const mockScore = 95;
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
        .mockResolvedValueOnce('3'); // completed = 3 (this will be the 4th puzzle)
      mockRedis.mget.mockResolvedValueOnce([
        JSON.stringify({ score: mockScore }), // puzzle 0
        JSON.stringify({ score: mockScore }), // puzzle 1
        JSON.stringify({ score: mockScore }), // puzzle 2
        null, // puzzle 3 (current submission)
      ]);

      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, puzzleIndex: 3 })));

      expect(response.status).toBe(200);
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'chesserGuesser:leaderboard:2024-01-15',
        expect.any(Number),
        'testuser123'
      );
    });

    it('should set TTL on all stored data', async () => {
      const mockScore = 95;
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
        .mockResolvedValueOnce('3'); // completed = 3 (this will be the 4th puzzle)
      mockRedis.mget.mockResolvedValueOnce([
        JSON.stringify({ score: mockScore }),
        JSON.stringify({ score: mockScore }),
        JSON.stringify({ score: mockScore }),
        null,
      ]);

      const response = await action(createActionArgs('/api/chesserGuesser/submit', createRequestBody({ ...validSubmission, puzzleIndex: 3 })));
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
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
        .mockResolvedValueOnce('0'); // completed = 0
      mockRedis.mget.mockResolvedValueOnce([null, null, null, null]);

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
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
        .mockResolvedValueOnce('0'); // completed = 0
      mockRedis.mget.mockResolvedValueOnce([null, null, null, null]);

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
      mockRedis.get
        .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache succeeds
        .mockRejectedValue(new Error('Redis connection failed')); // subsequent calls fail
      mockRedis.set.mockRejectedValue(new Error('Redis connection failed'));

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
      // Create puzzle cache with eval = 0 for puzzle 0
      const zeroPuzzles = JSON.stringify({
        date: '2024-01-15',
        puzzles: [
          { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', eval: 0 },
          { fen: 'test', eval: 50 },
          { fen: 'test', eval: -80 },
          { fen: 'test', eval: 200 },
        ],
        seed: 20240115,
      });
      mockRedis.get
        .mockResolvedValueOnce(zeroPuzzles) // daily puzzle cache
        .mockResolvedValueOnce('0'); // completed = 0
      mockRedis.mget.mockResolvedValueOnce([null, null, null, null]);

      const response = await action(createActionArgs('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'testuser',
          date: '2024-01-15',
          puzzleIndex: 0,
          guess: 0,
        }),
      }));

      const result = await response.json();
      expect(result.score).toBe(0); // Perfect guess (distance = 0)
    });

    it('should handle extreme evaluations', async () => {
      // Puzzle 0 eval is 120 from mockDailyPuzzles
      const extremeCases = [
        { guess: 120 },  // Perfect match
        { guess: -120 }, // Opposite
        { guess: 400 },  // Far off
      ];

      for (const { guess } of extremeCases) {
        mockRedis.get.mockClear();
        mockRedis.set.mockClear();
        mockRedis.mget.mockClear();
        mockRedis.set.mockResolvedValue('OK');
        mockRedis.get
          .mockResolvedValueOnce(mockDailyPuzzles) // daily puzzle cache
          .mockResolvedValueOnce('0'); // completed = 0
        mockRedis.mget.mockResolvedValue([null, null, null, null]);

        const response = await action(createActionArgs('/api/chesserGuesser/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'testuser',
            date: '2024-01-15',
            puzzleIndex: 0,
            guess,
          }),
        }));

        const result = await response.json();
        expect(result.score).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
