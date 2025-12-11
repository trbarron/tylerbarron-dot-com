/**
 * Tests for puzzle selection and scoring logic
 */

import { describe, it, expect } from 'vitest';
import {
  classifyDifficulty,
  selectDailyPuzzleIndices,
  calculatePuzzleScore,
  validateDeterminism,
} from '~/utils/chesserGuesser/puzzleSelection';

describe('Puzzle Selection Utils', () => {
  describe('classifyDifficulty', () => {
    it('should classify easy puzzles (50-150 cp)', () => {
      expect(classifyDifficulty(50)).toBe('easy');
      expect(classifyDifficulty(100)).toBe('easy');
      expect(classifyDifficulty(149)).toBe('easy');
      expect(classifyDifficulty(-50)).toBe('easy');
      expect(classifyDifficulty(-100)).toBe('easy');
      expect(classifyDifficulty(-149)).toBe('easy');
    });

    it('should classify medium puzzles (150-250 cp)', () => {
      expect(classifyDifficulty(150)).toBe('medium');
      expect(classifyDifficulty(200)).toBe('medium');
      expect(classifyDifficulty(249)).toBe('medium');
      expect(classifyDifficulty(-150)).toBe('medium');
      expect(classifyDifficulty(-200)).toBe('medium');
      expect(classifyDifficulty(-249)).toBe('medium');
    });

    it('should classify hard puzzles (250-350 cp)', () => {
      expect(classifyDifficulty(250)).toBe('hard');
      expect(classifyDifficulty(300)).toBe('hard');
      expect(classifyDifficulty(349)).toBe('hard');
      expect(classifyDifficulty(-250)).toBe('hard');
      expect(classifyDifficulty(-300)).toBe('hard');
      expect(classifyDifficulty(-349)).toBe('hard');
    });

    it('should classify expert puzzles (350-400 cp)', () => {
      expect(classifyDifficulty(350)).toBe('expert');
      expect(classifyDifficulty(375)).toBe('expert');
      expect(classifyDifficulty(400)).toBe('expert');
      expect(classifyDifficulty(-350)).toBe('expert');
      expect(classifyDifficulty(-375)).toBe('expert');
      expect(classifyDifficulty(-400)).toBe('expert');
    });

    it('should handle edge cases at boundaries', () => {
      expect(classifyDifficulty(49)).toBe('easy'); // Just below easy
      expect(classifyDifficulty(150)).toBe('medium'); // Exactly at boundary
      expect(classifyDifficulty(250)).toBe('hard'); // Exactly at boundary
      expect(classifyDifficulty(350)).toBe('expert'); // Exactly at boundary
    });
  });

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
    describe('Correct Side Detection', () => {
      it('should give full points for perfect guess', () => {
        expect(calculatePuzzleScore(100, 100)).toBe(100);
        expect(calculatePuzzleScore(-100, -100)).toBe(100);
        expect(calculatePuzzleScore(0, 0)).toBe(100);
      });

      it('should give points for correct side (white advantage)', () => {
        const score = calculatePuzzleScore(100, 120);
        expect(score).toBeGreaterThan(50);
        expect(score).toBeLessThanOrEqual(100);
      });

      it('should give points for correct side (black advantage)', () => {
        const score = calculatePuzzleScore(-100, -120);
        expect(score).toBeGreaterThan(50);
        expect(score).toBeLessThanOrEqual(100);
      });

      it('should give points for correct equal assessment', () => {
        const score = calculatePuzzleScore(10, 5);
        expect(score).toBeGreaterThan(50);
        expect(score).toBeLessThanOrEqual(100);
      });

      it('should give 0 points for wrong side', () => {
        expect(calculatePuzzleScore(100, -100)).toBe(0);
        expect(calculatePuzzleScore(-100, 100)).toBe(0);
        expect(calculatePuzzleScore(100, 0)).toBe(0);
        expect(calculatePuzzleScore(-100, 0)).toBe(0);
      });
    });

    describe('Accuracy Bonus Calculation', () => {
      it('should give maximum bonus (100) for perfect guess', () => {
        expect(calculatePuzzleScore(100, 100)).toBe(100);
        expect(calculatePuzzleScore(-50, -50)).toBe(100);
      });

      it('should decrease score with increasing difference', () => {
        const score1 = calculatePuzzleScore(100, 110);
        const score2 = calculatePuzzleScore(100, 150);
        const score3 = calculatePuzzleScore(100, 200);

        expect(score1).toBeGreaterThan(score2);
        expect(score2).toBeGreaterThan(score3);
      });

      it('should give minimum score (50) for maximum difference', () => {
        const score = calculatePuzzleScore(100, 500); // 400+ difference
        expect(score).toBe(50);
      });

      it('should handle small differences accurately', () => {
        const score1 = calculatePuzzleScore(100, 101);
        const score2 = calculatePuzzleScore(100, 105);
        const score3 = calculatePuzzleScore(100, 110);

        expect(score1).toBeGreaterThan(score2);
        expect(score2).toBeGreaterThan(score3);
        expect(score1).toBeGreaterThan(95);
      });
    });

    describe('Edge Cases', () => {
      it('should handle zero evaluations', () => {
        expect(calculatePuzzleScore(0, 0)).toBe(100);
        expect(calculatePuzzleScore(10, 0)).toBe(100); // Still equal range
        expect(calculatePuzzleScore(-10, 0)).toBe(100);
      });

      it('should handle boundary at ±20', () => {
        // Within equal range
        expect(calculatePuzzleScore(20, 20)).toBe(100);
        expect(calculatePuzzleScore(-20, -20)).toBe(100);
        expect(calculatePuzzleScore(15, 10)).toBeGreaterThan(50);

        // Outside equal range
        expect(calculatePuzzleScore(25, 15)).toBe(0); // Guess advantage, actual equal
        expect(calculatePuzzleScore(15, 25)).toBeGreaterThan(0); // Both advantage
      });

      it('should handle extreme evaluations', () => {
        expect(calculatePuzzleScore(400, 400)).toBe(100);
        expect(calculatePuzzleScore(-400, -400)).toBe(100);
        expect(calculatePuzzleScore(400, 350)).toBeGreaterThan(85);
      });

      it('should round to integer scores', () => {
        const scores = [
          calculatePuzzleScore(100, 110),
          calculatePuzzleScore(100, 123),
          calculatePuzzleScore(200, 234),
        ];

        scores.forEach(score => {
          expect(Number.isInteger(score)).toBe(true);
        });
      });
    });

    describe('Score Distribution', () => {
      it('should produce scores between 0 and 100', () => {
        const testCases = [
          { guess: 100, actual: 120 },
          { guess: -50, actual: -75 },
          { guess: 0, actual: 10 },
          { guess: 300, actual: 250 },
          { guess: -200, actual: -300 },
        ];

        testCases.forEach(({ guess, actual }) => {
          const score = calculatePuzzleScore(guess, actual);
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        });
      });

      it('should only give 50 or above when side is correct', () => {
        const correctSideCases = [
          { guess: 100, actual: 120 },
          { guess: 100, actual: 400 },
          { guess: -100, actual: -50 },
          { guess: 0, actual: 10 },
        ];

        correctSideCases.forEach(({ guess, actual }) => {
          const score = calculatePuzzleScore(guess, actual);
          expect(score).toBeGreaterThanOrEqual(50);
        });
      });

      it('should give 0 when side is wrong', () => {
        const wrongSideCases = [
          { guess: 100, actual: -100 },
          { guess: -100, actual: 100 },
          { guess: 50, actual: -50 },
          { guess: -200, actual: 200 },
        ];

        wrongSideCases.forEach(({ guess, actual }) => {
          const score = calculatePuzzleScore(guess, actual);
          expect(score).toBe(0);
        });
      });
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
    it('should score a nearly perfect guess highly', () => {
      const score = calculatePuzzleScore(100, 105);
      expect(score).toBeGreaterThan(95);
    });

    it('should give decent score for reasonable accuracy', () => {
      const score = calculatePuzzleScore(100, 150);
      expect(score).toBeGreaterThan(60);
      expect(score).toBeLessThan(95);
    });

    it('should give low score for poor accuracy', () => {
      const score = calculatePuzzleScore(100, 300);
      expect(score).toBeGreaterThan(50);
      expect(score).toBeLessThan(65);
    });

    it('should handle realistic game scenarios', () => {
      const scenarios = [
        { guess: 85, actual: 100, expectedRange: [90, 100] }, // Very close
        { guess: 150, actual: 200, expectedRange: [70, 90] }, // Good
        { guess: 100, actual: 250, expectedRange: [55, 75] }, // Okay
        { guess: 50, actual: 350, expectedRange: [50, 65] }, // Poor but correct side
      ];

      scenarios.forEach(({ guess, actual, expectedRange }) => {
        const score = calculatePuzzleScore(guess, actual);
        expect(score).toBeGreaterThanOrEqual(expectedRange[0]);
        expect(score).toBeLessThanOrEqual(expectedRange[1]);
      });
    });
  });
});
