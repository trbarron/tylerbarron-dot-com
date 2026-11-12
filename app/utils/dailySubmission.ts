/** Allow a game started yesterday to finish after midnight, without rewriting older leaderboards. */
export function isRecentPuzzleDate(date: unknown, today: string): date is string {
  if (typeof date !== 'string') return false;
  const yesterday = new Date(`${today}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return date === today || date === yesterday.toISOString().slice(0, 10);
}
