export const RETENTION_SECONDS = 30 * 24 * 60 * 60;
export interface Book {
  id: string;
  title: string;
}
export interface Ballot {
  up: string[];
  down: string[];
}
export interface PollView {
  id: string;
  title: string;
  books: Book[];
  upVotes: number;
  downVotes: number;
  allowMultipleVotes: boolean;
  expiresAt: number;
  closed: boolean;
  host: boolean;
  self: { name: string; ballot: Ballot | null } | null;
  participants?: { name: string; locked: boolean }[];
  results?: { id: string; title: string; up: number; down: number; score: number }[];
}
/** Accept the original single-downvote payload from already-open browser tabs. */
export function normalizeBallot(value: unknown): Ballot | null {
  if (!value || typeof value !== 'object') return null;
  const b = value as Record<string, unknown>;
  const down = typeof b.down === 'string' ? [b.down] : b.down;
  if (
    !Array.isArray(b.up) ||
    !Array.isArray(down) ||
    b.up.length > 30 ||
    down.length > 30 ||
    ![...b.up, ...down].every((id) => typeof id === 'string')
  )
    return null;
  return { up: b.up, down };
}

/** React Router also accepts case variants and encoded path segments. */
export function isBookClubPath(path: string): boolean {
  try {
    return /^\/book-club(?:\/|$)/i.test(decodeURIComponent(path));
  } catch {
    return false;
  }
}
