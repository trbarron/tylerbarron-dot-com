// Win chance from a centipawn eval, as Lichess computes it, so a "10 point"
// threshold here means what it means there. See docs/maia-drills.md.

/** Lichess's fit of eval to game result (lila PR #11148). */
const MULTIPLIER = -0.00368208;

/**
 * The mover's chance of winning, 0–100, for an eval in cp from their side.
 * Clamped to ±1000 cp first, like Lichess; card evals already are.
 */
export function winPercent(cp: number): number {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  return 50 + 50 * (2 / (1 + Math.exp(MULTIPLIER * clamped)) - 1);
}

/** How many points of win chance `worse` gives up against `better`, both cp from the mover's side. */
export function winDrop(better: number, worse: number): number {
  return winPercent(better) - winPercent(worse);
}
