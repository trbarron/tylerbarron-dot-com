// Daily puzzle selection logic with difficulty balancing

import { ChessPuzzle, DailyPuzzleSet } from './types';
import { createSeededRandom, dateSeed, getTodayDateString } from './seededRandom';

/**
 * Classify puzzle difficulty based on evaluation
 * Easy: ±50-150 cp
 * Medium: ±150-250 cp
 * Hard: ±250-350 cp
 * Expert: ±350-400 cp
 */
export function classifyDifficulty(evalCentipawns: number): 'easy' | 'medium' | 'hard' | 'expert' {
  const absEval = Math.abs(evalCentipawns);

  if (absEval >= 50 && absEval < 150) return 'easy';
  if (absEval >= 150 && absEval < 250) return 'medium';
  if (absEval >= 250 && absEval < 350) return 'hard';
  return 'expert'; // 350-400
}

/**
 * Select 4 puzzle indices deterministically based on date
 *
 * This function generates 4 indices (0 to totalPuzzles-1) that are:
 * 1. Deterministic - same date always produces same indices
 * 2. Well-distributed - indices are spread across the puzzle set
 * 3. Balanced - roughly one from each quarter of the difficulty range
 *
 * @param dateString - Date in YYYY-MM-DD format
 * @param totalPuzzles - Total number of puzzles available (default 400)
 * @returns Array of 4 puzzle indices
 */
export function selectDailyPuzzleIndices(
  dateString: string,
  totalPuzzles: number = 400
): number[] {
  const seed = dateSeed(dateString);
  const rng = createSeededRandom(seed);

  const indices: number[] = [];
  const quarterSize = Math.floor(totalPuzzles / 4);

  // Select one puzzle from each quarter to ensure variety
  // Quarter 1: indices 0-99 (easy puzzles likely)
  // Quarter 2: indices 100-199 (medium puzzles likely)
  // Quarter 3: indices 200-299 (hard puzzles likely)
  // Quarter 4: indices 300-399 (expert puzzles likely)
  for (let quarter = 0; quarter < 4; quarter++) {
    const start = quarter * quarterSize;
    const end = (quarter === 3) ? totalPuzzles : (quarter + 1) * quarterSize;
    const index = start + Math.floor(rng() * (end - start));
    indices.push(index);
  }

  return indices;
}

/**
 * Select daily puzzles with balanced difficulty (LEGACY - for when we have all puzzles)
 *
 * This function is kept for reference but is not used in the current implementation
 * since we don't fetch all puzzles. Instead, we use selectDailyPuzzleIndices.
 */
export function selectDailyPuzzles(
  allPuzzles: ChessPuzzle[],
  dateString: string = getTodayDateString()
): DailyPuzzleSet {
  const seed = dateSeed(dateString);
  const rng = createSeededRandom(seed);

  // Simple selection: pick 4 random puzzles deterministically
  const indices = selectDailyPuzzleIndices(dateString, allPuzzles.length);
  const selectedPuzzles = indices.map(i => ({
    ...allPuzzles[i],
    difficulty: classifyDifficulty(allPuzzles[i].eval)
  }));

  return {
    date: dateString,
    puzzles: selectedPuzzles,
    seed
  };
}

/**
 * Calculate score for a single puzzle attempt
 *
 * Scoring rules:
 * - Must guess correct side (white/black/equal) to score points
 * - If correct side:
 *   - Base score: 50 points
 *   - Bonus: Up to 50 points based on accuracy
 *   - Formula: 50 + (50 * (1 - min(|diff|/400, 1)))
 * - If wrong side: 0 points
 */
export function calculatePuzzleScore(
  guess: number,
  actual: number
): number {
  // Determine if guess is on correct side
  const correctSide = (() => {
    if (actual > 20 && guess > 0) return true; // Both white advantage
    if (actual < -20 && guess < 0) return true; // Both black advantage
    if (actual >= -20 && actual <= 20 && guess >= -20 && guess <= 20) return true; // Both equal
    return false;
  })();

  if (!correctSide) return 0;

  // Calculate accuracy bonus
  const diff = Math.abs(actual - guess);
  const accuracyRatio = Math.min(diff / 400, 1); // 400 = max difference
  const accuracyBonus = 50 * (1 - accuracyRatio);

  return Math.round(50 + accuracyBonus);
}

/**
 * Validate that daily puzzle selection is deterministic
 */
export function validateDeterminism(totalPuzzles: number = 400): boolean {
  const date = '2024-01-15';

  const indices1 = selectDailyPuzzleIndices(date, totalPuzzles);
  const indices2 = selectDailyPuzzleIndices(date, totalPuzzles);

  // Check that same date produces same indices
  if (indices1.length !== indices2.length) return false;

  for (let i = 0; i < indices1.length; i++) {
    if (indices1[i] !== indices2[i]) return false;
  }

  return true;
}

/**
 * Cache daily puzzles in localStorage
 */
export function cacheDailyPuzzles(puzzleSet: DailyPuzzleSet): void {
  try {
    localStorage.setItem('chesserGuesser:dailyPuzzles', JSON.stringify(puzzleSet));
  } catch (e) {
    console.warn('Failed to cache daily puzzles:', e);
  }
}

/**
 * Get cached daily puzzles from localStorage
 */
export function getCachedDailyPuzzles(): DailyPuzzleSet | null {
  try {
    const cached = localStorage.getItem('chesserGuesser:dailyPuzzles');
    if (!cached) return null;

    const puzzleSet: DailyPuzzleSet = JSON.parse(cached);

    // Check if cache is for today
    if (puzzleSet.date === getTodayDateString()) {
      return puzzleSet;
    }

    // Cache is stale
    return null;
  } catch (e) {
    console.warn('Failed to read cached daily puzzles:', e);
    return null;
  }
}
