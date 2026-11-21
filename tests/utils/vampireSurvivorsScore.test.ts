import { describe, expect, it } from 'vitest';
import { parseRecorderScore } from '~/utils/vampireSurvivors/leaderboard.server';

describe('parseRecorderScore', () => {
  const score = { name: 'Josh', time: 900, level: 23, kills: 3656 };

  it('accepts a score without a seed and stores the seed as null', () => {
    expect(parseRecorderScore(score)).toEqual({ ...score, seed: null });
    expect(parseRecorderScore({ ...score, seed: null })).toEqual({ ...score, seed: null });
  });

  it('keeps a valid seed', () => {
    expect(parseRecorderScore({ ...score, seed: 81101 })).toEqual({ ...score, seed: 81101 });
  });

  it('rejects an invalid seed', () => {
    for (const seed of [0, -1, 1.5, '81101', 2147483647]) {
      expect(parseRecorderScore({ ...score, seed })).toBeNull();
    }
  });
});
