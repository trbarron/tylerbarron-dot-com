// How every chess tool shows an engine evaluation.

/** Past this (±10 pawns, which covers mates however a tool stores them) the eval names the winner instead. */
const DECISIVE_CP = 1000;

/**
 * An eval for display, in the usual convention: pawns from White's side, signed
 * (`+1.2`, `-0.4`, `0.0`, never `-0.0`), or "White/Black is winning" past ±10.
 * One decimal unless a tool needs more (Chesser Guesser scores to the hundredth).
 */
export function formatEval(whiteCp: number, { decimals = 1 }: { decimals?: number } = {}): string {
  if (Math.abs(whiteCp) >= DECISIVE_CP) return whiteCp > 0 ? 'White is winning' : 'Black is winning';
  return formatPawns(whiteCp, { decimals });
}

/** Centipawns as signed pawns, for a change between evals rather than a position: `+1.2`, `-0.4`, `0.0`. */
export function formatPawns(cp: number, { decimals = 1 }: { decimals?: number } = {}): string {
  const pawns = Number((cp / 100).toFixed(decimals));
  if (pawns === 0) return (0).toFixed(decimals);
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(decimals)}`;
}
