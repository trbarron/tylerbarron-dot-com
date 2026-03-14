// localStorage utilities for Blunder Watch

const KEYS = {
  USERNAME: 'blunderWatch:username',
  LAST_RESULT: 'blunderWatch:lastResult', // { date, score, emoji } for "already played" state
} as const;

export function saveUsername(username: string): void {
  try {
    localStorage.setItem(KEYS.USERNAME, username);
  } catch {
    // Ignore storage errors
  }
}

export function loadUsername(): string | null {
  try {
    return localStorage.getItem(KEYS.USERNAME);
  } catch {
    return null;
  }
}

export interface StoredResult {
  date: string;
  score: number;
  blundersCaught: number;
  falsePositives: number;
  resultEmoji: string;
  gameNumber: number;
}

export function saveResult(result: StoredResult): void {
  try {
    localStorage.setItem(KEYS.LAST_RESULT, JSON.stringify(result));
  } catch {
    // Ignore storage errors
  }
}

export function loadResult(date: string): StoredResult | null {
  try {
    const raw = localStorage.getItem(KEYS.LAST_RESULT);
    if (!raw) return null;
    const stored: StoredResult = JSON.parse(raw);
    return stored.date === date ? stored : null;
  } catch {
    return null;
  }
}
