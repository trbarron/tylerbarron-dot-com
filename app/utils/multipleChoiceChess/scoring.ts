export const RANK_POINTS: Record<number, number> = {
  1: 4,
  2: 3,
  4: 2,
  6: 1,
};

export const RANK_COLORS: Record<number, string> = {
  1: 'bg-green-500 text-white',
  2: 'bg-yellow-400 text-black',
  4: 'bg-orange-500 text-white',
  6: 'bg-red-500 text-white',
};

export const RANK_LABELS: Record<number, string> = {
  1: 'Best!',
  2: '2nd best',
  4: '4th best',
  6: '6th best',
};

export function pointsForRank(rank: number): number {
  return RANK_POINTS[rank] ?? 0;
}

export function accuracy(score: number, moves: number): number {
  if (moves === 0) return 0;
  return Math.round((score / (moves * 4)) * 100);
}
