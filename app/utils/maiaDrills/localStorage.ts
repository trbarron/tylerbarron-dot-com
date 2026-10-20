// Per-browser conveniences for Maia Drills: the edit tokens for decks this
// browser built, the last form values, and completions the server hasn't
// confirmed yet. Drill progress itself lives on the server (progress.ts), so
// every device shares it. All of this is optional — every read tolerates
// missing or blocked storage.

import type { AnalysisSettings, GameSource } from './types';

const TOKENS_KEY = 'maiaDrills:editTokens';
const FORM_KEY = 'maiaDrills:form';
const PENDING_PREFIX = 'maiaDrills:pending:';
/** Where progress lived before it moved to the server: card id → { last: 'correct' | 'wrong', … }. */
const LEGACY_PROGRESS_PREFIX = 'maiaDrills:progress:';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or quota: the feature works without it.
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

export function loadEditToken(deckId: string): string | null {
  return read<Record<string, string>>(TOKENS_KEY, {})[deckId] ?? null;
}

export function saveEditToken(deckId: string, token: string) {
  write(TOKENS_KEY, { ...read<Record<string, string>>(TOKENS_KEY, {}), [deckId]: token });
}

export interface SavedForm {
  source: GameSource;
  username: string;
  maxGames: number;
  excludeBullet: boolean;
  settings: AnalysisSettings;
}

export function loadForm(): Partial<SavedForm> {
  return read<Partial<SavedForm>>(FORM_KEY, {});
}

export function saveForm(form: SavedForm) {
  write(FORM_KEY, form);
}

/**
 * Cards completed in this browser that the server hasn't confirmed: answers
 * given offline, plus, once, the cards this browser had solved back when
 * progress was kept here. Sending them is idempotent, so a repeat is harmless.
 */
export function loadPending(deckId: string): string[] {
  const pending = read<string[]>(PENDING_PREFIX + deckId, []);
  const legacy = read<Record<string, { last?: string }>>(LEGACY_PROGRESS_PREFIX + deckId, {});
  const solved = Object.keys(legacy).filter((id) => legacy[id]?.last === 'correct');
  return [...new Set([...pending, ...solved])];
}

/** Replace the queue; an empty one clears it, and with it any legacy progress (now on the server). */
export function savePending(deckId: string, ids: string[]) {
  remove(LEGACY_PROGRESS_PREFIX + deckId);
  if (ids.length) write(PENDING_PREFIX + deckId, ids);
  else remove(PENDING_PREFIX + deckId);
}
