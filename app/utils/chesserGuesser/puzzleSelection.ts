// Daily puzzle selection logic

import { ChessPuzzle, DailyPuzzleSet } from './types';
import { createSeededRandom, dateSeed, getTodayDateString } from './seededRandom';

/**
 * Select 4 puzzle indices deterministically based on date
 *
 * This function generates 4 indices (0 to totalPuzzles-1) that are:
 * 1. Deterministic - same date always produces same indices
 * 2. Well-distributed - indices are spread across the puzzle set
 * 3. Balanced - roughly one from each quarter of the puzzle range
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
  for (let quarter = 0; quarter < 4; quarter++) {
    const start = quarter * quarterSize;
    const end = (quarter === 3) ? totalPuzzles : (quarter + 1) * quarterSize;
    const index = start + Math.floor(rng() * (end - start));
    indices.push(index);
  }

  return indices;
}

/**
 * Select daily puzzles (LEGACY - for when we have all puzzles)
 *
 * This function is kept for reference but is not used in the current implementation
 * since we don't fetch all puzzles. Instead, we use selectDailyPuzzleIndices.
 */
export function selectDailyPuzzles(
  allPuzzles: ChessPuzzle[],
  dateString: string = getTodayDateString()
): DailyPuzzleSet {
  const seed = dateSeed(dateString);
  const _rng = createSeededRandom(seed);

  // Simple selection: pick 4 random puzzles deterministically
  const indices = selectDailyPuzzleIndices(dateString, allPuzzles.length);
  const selectedPuzzles = indices.map(i => allPuzzles[i]);

  return {
    date: dateString,
    puzzles: selectedPuzzles,
    seed
  };
}

export function calculatePuzzleScore(
  guess: number,
  actual: number
): number {
  return Math.abs(guess - actual);
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
