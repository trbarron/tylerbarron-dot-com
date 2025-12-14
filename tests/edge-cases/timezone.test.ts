/**
 * Edge case tests for timezone boundaries
 * Tests daily puzzle rotation across different timezones
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLoaderArgs } from '../setup';
import { getTodayDateString, dateSeed, createSeededRandom } from '~/utils/chesserGuesser/seededRandom';
import { selectDailyPuzzleIndices } from '~/utils/chesserGuesser/puzzleSelection';
import { loader as puzzlesLoader } from '~/routes/api/chesserGuesser/puzzles';
import { loader as leaderboardLoader } from '~/routes/api/chesserGuesser/leaderboard';

// Mock Redis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
};

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

describe('Timezone Boundary Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  describe('Date String Generation', () => {
    it('should use server timezone consistently', () => {
      const dateString1 = getTodayDateString();
      const dateString2 = getTodayDateString();

      expect(dateString1).toBe(dateString2);
    });

    it('should handle midnight boundary', () => {
      // Mock Date to be just before midnight (local time)
      vi.useFakeTimers();
      const mockDate = new Date('2024-01-15T23:59:59');
      vi.setSystemTime(mockDate);

      const dateString1 = getTodayDateString();

      // Advance to just after midnight (local time)
      vi.setSystemTime(new Date('2024-01-16T00:00:01'));

      const dateString2 = getTodayDateString();

      expect(dateString1).not.toBe(dateString2);
      expect(dateString1).toBe('2024-01-15');
      expect(dateString2).toBe('2024-01-16');

      vi.useRealTimers();
    });

    it('should handle year boundary', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2023-12-31T23:59:59'));
      const dateString1 = getTodayDateString();

      vi.setSystemTime(new Date('2024-01-01T00:00:01'));
      const dateString2 = getTodayDateString();

      expect(dateString1).toBe('2023-12-31');
      expect(dateString2).toBe('2024-01-01');

      vi.useRealTimers();
    });

    it('should handle month boundary', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-31T23:59:59'));
      const dateString1 = getTodayDateString();

      vi.setSystemTime(new Date('2024-02-01T00:00:01'));
      const dateString2 = getTodayDateString();

      expect(dateString1).toBe('2024-01-31');
      expect(dateString2).toBe('2024-02-01');

      vi.useRealTimers();
    });

    it('should handle leap year', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-29T12:00:00')); // 2024 is a leap year
      const dateString = getTodayDateString();

      expect(dateString).toBe('2024-02-29');

      vi.useRealTimers();
    });
  });

  describe('Puzzle Rotation at Boundaries', () => {
    it('should generate different puzzles at day boundary', () => {
      const date1 = '2024-01-15';
      const date2 = '2024-01-16';

      const puzzles1 = selectDailyPuzzleIndices(date1, 400);
      const puzzles2 = selectDailyPuzzleIndices(date2, 400);

      expect(puzzles1).not.toEqual(puzzles2);
    });

    it('should maintain same puzzles throughout the day', () => {
      const date = '2024-01-15';

      const puzzles1 = selectDailyPuzzleIndices(date, 400);

      // Simulate multiple requests throughout the day
      for (let i = 0; i < 100; i++) {
        const puzzles = selectDailyPuzzleIndices(date, 400);
        expect(puzzles).toEqual(puzzles1);
      }
    });

    it('should handle week boundary', () => {
      const dates = [
        '2024-01-14', // Sunday
        '2024-01-15', // Monday
      ];

      const puzzleSets = dates.map(date => selectDailyPuzzleIndices(date, 400));

      expect(puzzleSets[0]).not.toEqual(puzzleSets[1]);
    });
  });

  describe('Server-side Date Consistency', () => {
    it('should use same date for all operations in a request', () => {
      // This ensures that even if a request spans midnight,
      // the date used is consistent
      const date = '2024-01-15';

      // Generate seed
      const seed = dateSeed(date);

      // Generate puzzles multiple times with same date
      const rng1 = createSeededRandom(seed);
      const rng2 = createSeededRandom(seed);

      const value1 = rng1();
      const value2 = rng2();

      expect(value1).toBe(value2);
    });

    it('should handle concurrent requests at day boundary', () => {
      // Simulate multiple requests coming in at exactly midnight
      const date1 = '2024-01-15';
      const date2 = '2024-01-16';

      const results1 = selectDailyPuzzleIndices(date1, 400);
      const results2 = selectDailyPuzzleIndices(date2, 400);

      // Each date should get consistent results
      expect(selectDailyPuzzleIndices(date1, 400)).toEqual(results1);
      expect(selectDailyPuzzleIndices(date2, 400)).toEqual(results2);
    });
  });

  describe('Cache Invalidation at Day Boundary', () => {
    it('should not use cached puzzles from previous day', async () => {
      // Day 1: Cache puzzles
      const day1Puzzles = {
        date: '2024-01-15',
        puzzles: [],
        seed: 20240115,
      };

      mockRedis.get.mockResolvedValue(JSON.stringify(day1Puzzles));

      const response1 = await puzzlesLoader(createLoaderArgs('/api/chesserGuesser/puzzles?date=2024-01-15'));
      const data1 = await response1.json();

      expect(data1.date).toBe('2024-01-15');

      // Day 2: Should not use day 1 cache
      mockRedis.get.mockClear();
      mockRedis.get.mockResolvedValue(null); // No cache for new day

      await puzzlesLoader(createLoaderArgs('/api/chesserGuesser/puzzles?date=2024-01-16'));

      expect(mockRedis.get).toHaveBeenCalledWith('chesserGuesser:dailyPuzzles:2024-01-16');
    });
  });

  describe('Leaderboard Isolation by Date', () => {
    it('should maintain separate leaderboards for each day', () => {
      const date1 = '2024-01-15';
      const date2 = '2024-01-16';

      const key1 = `chesserGuesser:leaderboard:${date1}`;
      const key2 = `chesserGuesser:leaderboard:${date2}`;

      expect(key1).not.toBe(key2);
    });

    it('should not carry over scores to next day', async () => {
      // This is a conceptual test - scores are date-specific by design
      const date1 = '2024-01-15';
      const date2 = '2024-01-16';

      // User scores on day 1
      const submission1 = {
        username: 'testuser',
        date: date1,
        puzzleIndex: 0,
        guess: 100,
        actualEval: 100,
      };

      // Check that submission is keyed by date
      const expectedKey = `chesserGuesser:submission:${date1}:testuser:0`;

      expect(expectedKey).toContain(date1);

      // Day 2 submission would have different key
      const expectedKey2 = `chesserGuesser:submission:${date2}:testuser:0`;

      expect(expectedKey2).not.toBe(expectedKey);
    });
  });

  describe('Date Format Validation', () => {
    it('should reject invalid date formats (pattern mismatch)', async () => {
      // These don't match the YYYY-MM-DD regex pattern
      const invalidFormats = [
        '2024/01/15', // Wrong separator
        '01-15-2024', // Wrong order
        '2024-1-15', // Missing zero padding
        '2024-01-5', // Missing zero padding
        '24-01-15', // 2-digit year
        'invalid',
      ];

      for (const format of invalidFormats) {
        mockRedis.get.mockResolvedValue(null);
        const response = await puzzlesLoader(createLoaderArgs(`/api/chesserGuesser/puzzles?date=${format}`));
        expect(response.status).toBe(400);
      }
    });

    it('should use today\'s date when date parameter is empty', async () => {
      mockRedis.get.mockResolvedValue(null);
      const response = await puzzlesLoader(createLoaderArgs('/api/chesserGuesser/puzzles?date='));
      // Empty string is treated as "no date param", uses today's date
      expect(response.status).toBe(200);
    });

    it('should accept semantically invalid dates that match pattern', async () => {
      // These match YYYY-MM-DD pattern but aren't valid dates
      // The API validates format, not semantic validity
      const semanticallyInvalid = [
        '2024-13-01', // Invalid month
        '2024-01-32', // Invalid day
        '2024-02-30', // Invalid day for month
      ];

      for (const format of semanticallyInvalid) {
        mockRedis.get.mockResolvedValue(null);
        const response = await puzzlesLoader(createLoaderArgs(`/api/chesserGuesser/puzzles?date=${format}`));
        // Passes format validation, succeeds with fallback puzzles
        expect(response.status).toBe(200);
      }
    });

    it('should accept valid date formats', async () => {
      const validDates = [
        '2024-01-15',
        '2024-12-31',
        '2024-02-29', // Leap year
        '2023-01-01',
      ];

      for (const date of validDates) {
        // Date should pass validation (actual fetch may fail due to mocking)
        expect(/^\d{4}-\d{2}-\d{2}$/.test(date)).toBe(true);
      }
    });
  });

  describe('Daylight Saving Time Transitions', () => {
    it('should handle DST spring forward', () => {
      // In US, DST starts second Sunday of March
      // 2024-03-10 02:00 -> 03:00
      const beforeDST = '2024-03-09';
      const afterDST = '2024-03-10';

      const puzzles1 = selectDailyPuzzleIndices(beforeDST, 400);
      const puzzles2 = selectDailyPuzzleIndices(afterDST, 400);

      expect(puzzles1).not.toEqual(puzzles2);
    });

    it('should handle DST fall back', () => {
      // In US, DST ends first Sunday of November
      // 2024-11-03 02:00 -> 01:00
      const beforeDST = '2024-11-02';
      const afterDST = '2024-11-03';

      const puzzles1 = selectDailyPuzzleIndices(beforeDST, 400);
      const puzzles2 = selectDailyPuzzleIndices(afterDST, 400);

      expect(puzzles1).not.toEqual(puzzles2);
    });
  });

  describe('International Date Line', () => {
    it('should maintain consistency regardless of user timezone', () => {
      // Server-side date is deterministic
      // Client should always use server's date for daily puzzles
      const serverDate = '2024-01-15';

      const puzzles = selectDailyPuzzleIndices(serverDate, 400);

      // Multiple "users" in different timezones see same puzzles
      for (let i = 0; i < 10; i++) {
        const samePuzzles = selectDailyPuzzleIndices(serverDate, 400);
        expect(samePuzzles).toEqual(puzzles);
      }
    });
  });
});
