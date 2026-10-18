/**
 * Drill progress counts read from localStorage.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { solvedCount, saveProgress } from '~/utils/maiaDrills/localStorage';

describe('solvedCount', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('is null for a deck never drilled in this browser', () => {
    expect(solvedCount('deck1')).toBeNull();
    expect(solvedCount('deck1', ['a', 'b'])).toBeNull();
  });

  it('counts cards whose last answer was right as solved', () => {
    saveProgress('deck1', {
      a: { seen: 2, correct: 1, last: 'correct' },
      b: { seen: 1, correct: 0, last: 'wrong' },
      c: { seen: 3, correct: 2, last: 'correct' },
    });
    expect(solvedCount('deck1')).toBe(2);
  });

  it('counts only the given cards when the deck is known', () => {
    saveProgress('deck1', {
      a: { seen: 1, correct: 1, last: 'correct' },
      gone: { seen: 1, correct: 1, last: 'correct' },
    });
    expect(solvedCount('deck1', ['a', 'b'])).toBe(1);
    // Progress exists, but for none of these cards.
    expect(solvedCount('deck1', ['b'])).toBeNull();
  });

  it('works without storage', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(solvedCount('deck1')).toBeNull();
  });
});
