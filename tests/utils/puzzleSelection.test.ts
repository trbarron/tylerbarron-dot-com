/**
 * Tests for puzzle selection and scoring logic
 */

import { describe, it, expect } from 'vitest';
import {
  selectDailyPuzzleIndices,
  calculatePuzzleScore,
  validateDeterminism,
} from '~/utils/chesserGuesser/puzzleSelection';

describe('Puzzle Selection Utils', () => {
  describe('selectDailyPuzzleIndices', () => {
    it('should return exactly 4 indices', () => {
      const indices = selectDailyPuzzleIndices('2024-01-15', 400);
      expect(indices).toHaveLength(4);
    });

    it('should return indices within valid range', () => {
      const totalPuzzles = 400;
      const indices = selectDailyPuzzleIndices('2024-01-15', totalPuzzles);

      indices.forEach(index => {
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(totalPuzzles);
      });
    });

    it('should be deterministic for same date', () => {
      const date = '2024-01-15';
      const indices1 = selectDailyPuzzleIndices(date, 400);
      const indices2 = selectDailyPuzzleIndices(date, 400);

      expect(indices1).toEqual(indices2);
    });

    it('should return different indices for different dates', () => {
      const indices1 = selectDailyPuzzleIndices('2024-01-15', 400);
      const indices2 = selectDailyPuzzleIndices('2024-01-16', 400);

      expect(indices1).not.toEqual(indices2);
    });

    it('should distribute indices across quarters', () => {
      const indices = selectDailyPuzzleIndices('2024-01-15', 400);
      const quarterSize = 100;

      // Check that we have one from each quarter (roughly)
      const quarters = [0, 0, 0, 0];
      indices.forEach(index => {
        const quarter = Math.floor(index / quarterSize);
        quarters[quarter]++;
      });

      // Each quarter should have exactly 1 index
      expect(quarters).toEqual([1, 1, 1, 1]);
    });

    it('should handle different total puzzle counts', () => {
      const counts = [100, 200, 400, 1000];

      counts.forEach(count => {
        const indices = selectDailyPuzzleIndices('2024-01-15', count);
        expect(indices).toHaveLength(4);
        indices.forEach(index => {
          expect(index).toBeLessThan(count);
        });
      });
    });

    it('should handle year boundaries', () => {
      const dates = [
        '2023-12-31',
        '2024-01-01',
        '2024-12-31',
        '2025-01-01',
      ];

      const allIndices = dates.map(date => selectDailyPuzzleIndices(date, 400));

      // Each date should produce unique indices
      for (let i = 0; i < allIndices.length - 1; i++) {
        expect(allIndices[i]).not.toEqual(allIndices[i + 1]);
      }
    });
  });

  describe('calculatePuzzleScore', () => {
    it('should return 0 for perfect guess', () => {
      expect(calculatePuzzleScore(100, 100)).toBe(0);
      expect(calculatePuzzleScore(-100, -100)).toBe(0);
      expect(calculatePuzzleScore(0, 0)).toBe(0);
    });

    it('should return absolute distance for positive evals', () => {
      expect(calculatePuzzleScore(100, 120)).toBe(20);
      expect(calculatePuzzleScore(120, 100)).toBe(20);
      expect(calculatePuzzleScore(50, 150)).toBe(100);
    });

    it('should return absolute distance for negative evals', () => {
      expect(calculatePuzzleScore(-100, -120)).toBe(20);
      expect(calculatePuzzleScore(-120, -100)).toBe(20);
      expect(calculatePuzzleScore(-50, -150)).toBe(100);
    });

    it('should return absolute distance when crossing zero', () => {
      expect(calculatePuzzleScore(100, -100)).toBe(200);
      expect(calculatePuzzleScore(-100, 100)).toBe(200);
      expect(calculatePuzzleScore(50, -50)).toBe(100);
    });

    it('should handle zero evaluations', () => {
      expect(calculatePuzzleScore(0, 0)).toBe(0);
      expect(calculatePuzzleScore(10, 0)).toBe(10);
      expect(calculatePuzzleScore(-10, 0)).toBe(10);
      expect(calculatePuzzleScore(0, 50)).toBe(50);
    });

    it('should handle extreme evaluations', () => {
      expect(calculatePuzzleScore(400, 400)).toBe(0);
      expect(calculatePuzzleScore(-400, -400)).toBe(0);
      expect(calculatePuzzleScore(400, 350)).toBe(50);
      expect(calculatePuzzleScore(-400, -350)).toBe(50);
    });

    it('should return integer scores', () => {
      const scores = [
        calculatePuzzleScore(100, 110),
        calculatePuzzleScore(100, 123),
        calculatePuzzleScore(200, 234),
        calculatePuzzleScore(-50, -75),
      ];

      scores.forEach(score => {
        expect(Number.isInteger(score)).toBe(true);
      });
    });

    it('should be symmetric (distance is same regardless of order)', () => {
      expect(calculatePuzzleScore(100, 150)).toBe(calculatePuzzleScore(150, 100));
      expect(calculatePuzzleScore(-100, -50)).toBe(calculatePuzzleScore(-50, -100));
      expect(calculatePuzzleScore(0, 100)).toBe(calculatePuzzleScore(100, 0));
    });

    it('should increase score with larger differences', () => {
      const score1 = calculatePuzzleScore(100, 101);
      const score2 = calculatePuzzleScore(100, 150);
      const score3 = calculatePuzzleScore(100, 300);

      expect(score1).toBeLessThan(score2);
      expect(score2).toBeLessThan(score3);
    });
  });

  describe('validateDeterminism', () => {
    it('should confirm puzzle selection is deterministic', () => {
      expect(validateDeterminism(400)).toBe(true);
    });

    it('should work with different puzzle counts', () => {
      expect(validateDeterminism(100)).toBe(true);
      expect(validateDeterminism(200)).toBe(true);
      expect(validateDeterminism(1000)).toBe(true);
    });
  });

  describe('Realistic Scoring Scenarios', () => {
    it('should give low score for nearly perfect guess', () => {
      const score = calculatePuzzleScore(100, 105);
      expect(score).toBeLessThan(10);
    });

    it('should give medium score for moderate accuracy', () => {
      const score = calculatePuzzleScore(100, 150);
      expect(score).toBeGreaterThan(40);
      expect(score).toBeLessThan(60);
    });

    it('should give high score for poor accuracy', () => {
      const score = calculatePuzzleScore(100, 300);
      expect(score).toBeGreaterThan(150);
    });

    it('should handle realistic game scenarios', () => {
      const scenarios = [
        { guess: 85, actual: 100, expected: 15 }, // Very close
        { guess: 150, actual: 200, expected: 50 }, // Moderate
        { guess: 100, actual: 250, expected: 150 }, // Large difference
        { guess: 50, actual: 350, expected: 300 }, // Very large difference
      ];

      scenarios.forEach(({ guess, actual, expected }) => {
        const score = calculatePuzzleScore(guess, actual);
        expect(score).toBe(expected);
      });
    });
  });
});
