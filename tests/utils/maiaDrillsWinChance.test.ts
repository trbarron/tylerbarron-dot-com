/**
 * Win chance from an eval, matching Lichess's formula so its thresholds carry over.
 */

import { describe, it, expect } from 'vitest';
import { winDrop, winPercent } from '~/utils/maiaDrills/winChance';

describe('win chance', () => {
  it('is even at 0 and symmetric between the sides', () => {
    expect(winPercent(0)).toBe(50);
    expect(winPercent(300) + winPercent(-300)).toBeCloseTo(100, 10);
  });

  it('matches Lichess: +1.10 is ~60%, and evals clamp at ±1000', () => {
    expect(winPercent(110)).toBeCloseTo(60, 0);
    expect(winPercent(1000)).toBeCloseTo(97.5, 1);
    expect(winPercent(5000)).toBe(winPercent(1000));
  });

  it('shrinks the same cp gap as the position gets more one-sided', () => {
    expect(winDrop(100, 0)).toBeGreaterThan(winDrop(600, 500));
    expect(winDrop(600, 500)).toBeGreaterThan(winDrop(900, 800));
  });
});
