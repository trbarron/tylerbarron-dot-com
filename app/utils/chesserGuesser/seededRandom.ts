// Seeded Random Number Generator using Mulberry32 algorithm
// Ensures deterministic puzzle selection based on date

/**
 * Mulberry32 - A simple, fast seeded random number generator
 * Returns a function that generates pseudo-random numbers between 0 and 1
 */
export function createSeededRandom(seed: number): () => number {
  let state = seed;

  return function() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a deterministic seed from a date string
 * Same date always produces same seed
 */
export function dateSeed(dateString: string): number {
  // Convert YYYY-MM-DD to a simple hash
  const parts = dateString.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  // Create a unique seed from the date components
  // Use prime numbers to reduce collision probability
  return (year * 10000 + month * 100 + day) * 2654435761;
}

/**
 * Shuffle an array using Fisher-Yates algorithm with seeded random
 */
export function seededShuffle<T>(array: T[], rng: () => number): T[] {
  const result = [...array];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/**
 * Select random elements from an array using seeded random
 */
export function seededSelect<T>(
  array: T[],
  count: number,
  rng: () => number
): T[] {
  const shuffled = seededShuffle(array, rng);
  return shuffled.slice(0, count);
}

/**
 * Get today's date string in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Test if seeded random is working correctly
 */
export function testSeededRandom(): boolean {
  const seed = 12345;
  const rng1 = createSeededRandom(seed);
  const rng2 = createSeededRandom(seed);

  // Same seed should produce same sequence
  for (let i = 0; i < 100; i++) {
    if (rng1() !== rng2()) {
      return false;
    }
  }

  return true;
}
