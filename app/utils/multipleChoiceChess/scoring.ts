const RANK_POINTS: Record<number, number> = {
  1: 4,
  2: 3,
  4: 2,
  6: 1,
};

export function pointsForRank(rank: number): number {
  return RANK_POINTS[rank] ?? 0;
}

export function accuracy(score: number, moves: number): number {
  if (moves === 0) return 0;
  return Math.round((score / (moves * 4)) * 100);
}
