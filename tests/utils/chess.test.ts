/**
 * The shared chess helpers: eval display, UCI moves, engine score parsing.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { formatEval, formatPawns } from '~/utils/chess/evaluation';
import { parseUci, uciArrow } from '~/utils/chess/moves';
import { parseScore, scoreValue, STOCKFISH_CDN, STOCKFISH_VERSION } from '~/utils/chess/stockfish';

describe('formatEval', () => {
  it('shows signed pawns from White’s side, one decimal by default', () => {
    expect(formatEval(60)).toBe('+0.6');
    expect(formatEval(-230)).toBe('-2.3');
    expect(formatEval(0)).toBe('0.0');
    expect(formatEval(25, { decimals: 2 })).toBe('+0.25');
  });

  it('never shows -0.0', () => {
    expect(formatEval(-4)).toBe('0.0');
    expect(formatEval(-0.4, { decimals: 2 })).toBe('0.00');
  });

  it('names the winner past ten pawns, mates included', () => {
    expect(formatEval(999)).toBe('+10.0');
    expect(formatEval(1000)).toBe('White is winning');
    expect(formatEval(-10_000)).toBe('Black is winning');
  });

  it('shows a change in pawns without naming a winner', () => {
    expect(formatPawns(-1250)).toBe('-12.5');
    expect(formatPawns(0)).toBe('0.0');
  });
});

describe('UCI moves', () => {
  it('splits a move for chess.js, with the promotion only when there is one', () => {
    expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4' });
    expect(parseUci('e7e8q')).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
  });

  it('draws an arrow from a move', () => {
    expect(uciArrow('g1f3', 'green')).toEqual({ orig: 'g1', dest: 'f3', brush: 'green' });
  });
});

describe('engine output', () => {
  it('reads cp and mate scores off info lines', () => {
    expect(parseScore('info depth 12 seldepth 18 multipv 1 score cp -34 nodes 1 pv e7e5')).toEqual({
      type: 'cp',
      value: -34,
    });
    expect(parseScore('info depth 5 score mate -2 pv h7h6')).toEqual({ type: 'mate', value: -2 });
    expect(parseScore('info string NNUE evaluation enabled')).toBeNull();
  });

  it('ranks mates above any centipawn score, sooner mates higher', () => {
    expect(scoreValue({ type: 'mate', value: 1 })).toBeGreaterThan(scoreValue({ type: 'mate', value: 3 }));
    expect(scoreValue({ type: 'mate', value: 3 })).toBeGreaterThan(scoreValue({ type: 'cp', value: 5000 }));
    expect(scoreValue({ type: 'mate', value: 0 })).toBeLessThan(scoreValue({ type: 'cp', value: -5000 }));
  });

  it('pins one engine build for browser and server', () => {
    expect(STOCKFISH_CDN).toBe(`https://unpkg.com/stockfish@${STOCKFISH_VERSION}/bin`);
    // The server's devDependency must be the same build, or dev and prod judge differently.
    expect(STOCKFISH_VERSION).toBe(JSON.parse(readFileSync('node_modules/stockfish/package.json', 'utf8')).version);
  });
});
