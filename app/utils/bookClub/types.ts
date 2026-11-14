export const RETENTION_SECONDS = 30 * 24 * 60 * 60;
export interface Book {
  id: string;
  title: string;
}
export interface Ballot {
  up: string[];
  down: string;
}
export interface PollView {
  id: string;
  title: string;
  books: Book[];
  expiresAt: number;
  closed: boolean;
  host: boolean;
  self: { name: string; ballot: Ballot | null } | null;
  participants?: { name: string; locked: boolean }[];
  results?: { id: string; title: string; up: number; down: number; score: number }[];
}
export function validBallot(value: unknown): value is Ballot {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  return (
    Array.isArray(b.up) &&
    b.up.length === 2 &&
    b.up.every((x) => typeof x === 'string') &&
    typeof b.down === 'string' &&
    new Set([...b.up, b.down]).size === 3
  );
}

/** React Router also accepts case variants and encoded path segments. */
export function isBookClubPath(path: string): boolean {
  try {
    return /^\/book-club(?:\/|$)/i.test(decodeURIComponent(path));
  } catch {
    return false;
  }
}
