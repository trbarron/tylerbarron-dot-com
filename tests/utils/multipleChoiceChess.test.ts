/**
 * Multiple Choice Chess: scoring and reading the engine's MultiPV output.
 */

import { describe, it, expect } from 'vitest';
import { accuracy, pointsForRank } from '~/utils/multipleChoiceChess/scoring';
import { parseMultiPV, shuffle } from '~/utils/multipleChoiceChess/moveParser';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const info = (depth: number, multipv: number, pv: string) =>
  `info depth ${depth} seldepth ${depth + 4} multipv ${multipv} score cp 20 nodes 1000 pv ${pv} e7e5`;

describe('scoring', () => {
  it('gives 4, 3, 2 and 1 points for the engine’s 1st, 2nd, 4th and 6th best, nothing otherwise', () => {
    expect([1, 2, 4, 6].map(pointsForRank)).toEqual([4, 3, 2, 1]);
    expect([0, 3, 5, 7].map(pointsForRank)).toEqual([0, 0, 0, 0]);
  });

  it('scores accuracy against always picking the best move', () => {
    expect(accuracy(0, 0)).toBe(0);
    expect(accuracy(8, 2)).toBe(100);
    expect(accuracy(5, 3)).toBe(42); // 5 of 12, rounded
  });
});

describe('parseMultiPV', () => {
  it('offers the 1st, 2nd, 4th and 6th lines, from the deepest search, with SAN', () => {
    const lines = [
      info(8, 1, 'd2d4'),
      info(10, 1, 'e2e4'),
      info(10, 2, 'd2d4'),
      info(10, 3, 'g1f3'),
      info(10, 4, 'c2c4'),
      info(10, 5, 'b1c3'),
      info(10, 6, 'g2g3'),
    ];
    expect(parseMultiPV(lines, START)).toEqual([
      { uci: 'e2e4', san: 'e4', rank: 1 },
      { uci: 'd2d4', san: 'd4', rank: 2 },
      { uci: 'c2c4', san: 'c4', rank: 4 },
      { uci: 'g2g3', san: 'g3', rank: 6 },
    ]);
  });

  it('skips ranks the search didn’t reach and moves that aren’t legal', () => {
    const lines = [info(10, 1, 'e2e4'), info(10, 2, 'e2e5'), 'info string NNUE enabled'];
    expect(parseMultiPV(lines, START)).toEqual([{ uci: 'e2e4', san: 'e4', rank: 1 }]);
  });

  it('keeps promotions', () => {
    const fen = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
    expect(parseMultiPV([info(10, 1, 'e7e8q')], fen)).toEqual([{ uci: 'e7e8q', san: 'e8=Q', rank: 1 }]);
  });

  it('shuffles a copy, keeping every move', () => {
    const moves = [1, 2, 3, 4, 5, 6];
    const shuffled = shuffle(moves);
    expect(moves).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...shuffled].sort()).toEqual(moves);
  });
});
