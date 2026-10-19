// Moves in UCI form ("e2e4", "e7e8q"), as engines and our stored games use them.

import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';

/** The parts chess.js's move() takes. */
export function parseUci(uci: string): { from: string; to: string; promotion?: string } {
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), ...(uci[4] ? { promotion: uci[4] } : {}) };
}

/** An arrow for the board. Brushes: green, red, blue, yellow (and the pale variants). */
export function uciArrow(uci: string, brush: string): DrawShape {
  return { orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush };
}
