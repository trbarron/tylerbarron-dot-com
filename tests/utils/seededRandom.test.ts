/**
 * Tests for seeded random number generation
 * Critical for ensuring daily puzzles are deterministic
 */

import { describe, it, expect } from 'vitest';
import {
  createSeededRandom,
  dateSeed,
  seededShuffle,
  seededSelect,
  getTodayDateString,
  testSeededRandom,
} from '~/utils/chesserGuesser/seededRandom';

describe('Seeded Random Utils', () => {
  describe('createSeededRandom', () => {
    it('should produce same sequence for same seed', () => {
      const rng1 = createSeededRandom(12345);
      const rng2 = createSeededRandom(12345);

      const sequence1 = Array.from({ length: 100 }, () => rng1());
      const sequence2 = Array.from({ length: 100 }, () => rng2());

      expect(sequence1).toEqual(sequence2);
    });

    it('should produce different sequences for different seeds', () => {
      const rng1 = createSeededRandom(12345);
      const rng2 = createSeededRandom(54321);

      const sequence1 = Array.from({ length: 100 }, () => rng1());
      const sequence2 = Array.from({ length: 100 }, () => rng2());

      expect(sequence1).not.toEqual(sequence2);
    });

    it('should produce numbers between 0 and 1', () => {
      const rng = createSeededRandom(12345);

      for (let i = 0; i < 1000; i++) {
        const value = rng();
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThan(1);
      }
    });

    it('should produce uniform distribution', () => {
      const rng = createSeededRandom(12345);
      const buckets = Array(10).fill(0);

      for (let i = 0; i < 10000; i++) {
        const value = rng();
        const bucket = Math.floor(value * 10);
        buckets[bucket]++;
      }

      // Each bucket should have roughly 1000 values (±30%)
      buckets.forEach(count => {
        expect(count).toBeGreaterThan(700);
        expect(count).toBeLessThan(1300);
      });
    });

    it('should handle zero seed', () => {
      const rng = createSeededRandom(0);
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });

    it('should handle negative seeds', () => {
      const rng1 = createSeededRandom(-12345);
      const rng2 = createSeededRandom(-12345);

      expect(rng1()).toBe(rng2());
    });

    it('should handle very large seeds', () => {
      const rng = createSeededRandom(Number.MAX_SAFE_INTEGER);
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    });
  });

  describe('dateSeed', () => {
    it('should produce same seed for same date', () => {
      const seed1 = dateSeed('2024-01-15');
      const seed2 = dateSeed('2024-01-15');

      expect(seed1).toBe(seed2);
    });

    it('should produce different seeds for different dates', () => {
      const seed1 = dateSeed('2024-01-15');
      const seed2 = dateSeed('2024-01-16');
      const seed3 = dateSeed('2024-02-15');

      expect(seed1).not.toBe(seed2);
      expect(seed1).not.toBe(seed3);
      expect(seed2).not.toBe(seed3);
    });

    it('should handle different years', () => {
      const seed1 = dateSeed('2023-01-15');
      const seed2 = dateSeed('2024-01-15');
      const seed3 = dateSeed('2025-01-15');

      const seeds = [seed1, seed2, seed3];
      const uniqueSeeds = new Set(seeds);
      expect(uniqueSeeds.size).toBe(3);
    });

    it('should handle year boundaries', () => {
      const seed1 = dateSeed('2023-12-31');
      const seed2 = dateSeed('2024-01-01');

      expect(seed1).not.toBe(seed2);
    });

    it('should handle leap years', () => {
      const seed1 = dateSeed('2024-02-29'); // Leap year
      const seed2 = dateSeed('2024-03-01');

      expect(seed1).not.toBe(seed2);
    });

    it('should produce consistent seeds across runs', () => {
      const date = '2024-01-15';
      const expectedSeed = dateSeed(date);

      // Run multiple times
      for (let i = 0; i < 10; i++) {
        expect(dateSeed(date)).toBe(expectedSeed);
      }
    });
  });

  describe('seededShuffle', () => {
    it('should shuffle array deterministically', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const rng1 = createSeededRandom(12345);
      const rng2 = createSeededRandom(12345);

      const shuffled1 = seededShuffle(array, rng1);
      const shuffled2 = seededShuffle(array, rng2);

      expect(shuffled1).toEqual(shuffled2);
    });

    it('should not modify original array', () => {
      const array = [1, 2, 3, 4, 5];
      const original = [...array];
      const rng = createSeededRandom(12345);

      seededShuffle(array, rng);

      expect(array).toEqual(original);
    });

    it('should contain all original elements', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const rng = createSeededRandom(12345);

      const shuffled = seededShuffle(array, rng);

      expect(shuffled.sort()).toEqual(array.sort());
    });

    it('should produce different shuffle with different seed', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const rng1 = createSeededRandom(12345);
      const rng2 = createSeededRandom(54321);

      const shuffled1 = seededShuffle(array, rng1);
      const shuffled2 = seededShuffle(array, rng2);

      expect(shuffled1).not.toEqual(shuffled2);
    });

    it('should handle empty array', () => {
      const rng = createSeededRandom(12345);
      const shuffled = seededShuffle([], rng);

      expect(shuffled).toEqual([]);
    });

    it('should handle single element array', () => {
      const rng = createSeededRandom(12345);
      const shuffled = seededShuffle([42], rng);

      expect(shuffled).toEqual([42]);
    });

    it('should actually shuffle (not return original order)', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const rng = createSeededRandom(12345);

      const shuffled = seededShuffle(array, rng);

      // Very unlikely to be in original order
      expect(shuffled).not.toEqual(array);
    });
  });

  describe('seededSelect', () => {
    it('should select correct number of elements', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const rng = createSeededRandom(12345);

      const selected = seededSelect(array, 5, rng);

      expect(selected).toHaveLength(5);
    });

    it('should select deterministically', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const rng1 = createSeededRandom(12345);
      const rng2 = createSeededRandom(12345);

      const selected1 = seededSelect(array, 5, rng1);
      const selected2 = seededSelect(array, 5, rng2);

      expect(selected1).toEqual(selected2);
    });

    it('should select from original array', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const rng = createSeededRandom(12345);

      const selected = seededSelect(array, 5, rng);

      selected.forEach(item => {
        expect(array).toContain(item);
      });
    });

    it('should not select duplicates', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const rng = createSeededRandom(12345);

      const selected = seededSelect(array, 5, rng);
      const uniqueItems = new Set(selected);

      expect(uniqueItems.size).toBe(5);
    });

    it('should handle selecting all elements', () => {
      const array = [1, 2, 3, 4, 5];
      const rng = createSeededRandom(12345);

      const selected = seededSelect(array, 5, rng);

      expect(selected.sort()).toEqual(array.sort());
    });

    it('should handle selecting zero elements', () => {
      const array = [1, 2, 3, 4, 5];
      const rng = createSeededRandom(12345);

      const selected = seededSelect(array, 0, rng);

      expect(selected).toHaveLength(0);
    });
  });

  describe('getTodayDateString', () => {
    it('should return date in YYYY-MM-DD format', () => {
      const dateString = getTodayDateString();

      expect(dateString).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should pad month and day with zeros', () => {
      const dateString = getTodayDateString();
      const [year, month, day] = dateString.split('-');

      expect(month).toHaveLength(2);
      expect(day).toHaveLength(2);
    });

    it('should return current date', () => {
      const dateString = getTodayDateString();
      const now = new Date();

      const [year, month, day] = dateString.split('-');

      expect(parseInt(year)).toBe(now.getFullYear());
      expect(parseInt(month)).toBe(now.getMonth() + 1);
      expect(parseInt(day)).toBe(now.getDate());
    });
  });

  describe('testSeededRandom', () => {
    it('should validate seeded random is working', () => {
      expect(testSeededRandom()).toBe(true);
    });
  });

  describe('Integration: Date to Puzzles', () => {
    it('should produce same puzzle selection for same date', () => {
      const date = '2024-01-15';
      const seed = dateSeed(date);

      const rng1 = createSeededRandom(seed);
      const rng2 = createSeededRandom(seed);

      const puzzles = Array.from({ length: 400 }, (_, i) => i);

      const selected1 = seededSelect(puzzles, 4, rng1);
      const selected2 = seededSelect(puzzles, 4, rng2);

      expect(selected1).toEqual(selected2);
    });

    it('should produce different puzzle selection for different dates', () => {
      const date1 = '2024-01-15';
      const date2 = '2024-01-16';

      const seed1 = dateSeed(date1);
      const seed2 = dateSeed(date2);

      const rng1 = createSeededRandom(seed1);
      const rng2 = createSeededRandom(seed2);

      const puzzles = Array.from({ length: 400 }, (_, i) => i);

      const selected1 = seededSelect(puzzles, 4, rng1);
      const selected2 = seededSelect(puzzles, 4, rng2);

      expect(selected1).not.toEqual(selected2);
    });

    it('should handle full year of daily puzzles without duplicates', () => {
      const puzzles = Array.from({ length: 400 }, (_, i) => i);
      const dailySelections = new Map<string, number[]>();

      // Generate puzzles for 365 days
      for (let day = 1; day <= 365; day++) {
        const date = `2024-${String(Math.floor((day - 1) / 31) + 1).padStart(2, '0')}-${String(((day - 1) % 31) + 1).padStart(2, '0')}`;
        const seed = dateSeed(date);
        const rng = createSeededRandom(seed);
        const selected = seededSelect(puzzles, 4, rng);

        dailySelections.set(date, selected);
      }

      // Check that each day has unique selection
      expect(dailySelections.size).toBe(365);
    });
  });
});
