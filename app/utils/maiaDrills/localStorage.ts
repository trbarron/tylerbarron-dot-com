// Per-browser conveniences for Maia Drills: the edit tokens for decks this
// browser built, the last form values, and per-card drill progress. All of it
// is optional — every read tolerates missing or blocked storage.

import type { AnalysisSettings, GameSource } from './types';

const TOKENS_KEY = 'maiaDrills:editTokens';
const FORM_KEY = 'maiaDrills:form';
const PROGRESS_PREFIX = 'maiaDrills:progress:';

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

export interface CardProgress {
  seen: number;
  correct: number;
  last: 'correct' | 'wrong';
}

export function loadProgress(deckId: string): Record<string, CardProgress> {
  return read<Record<string, CardProgress>>(PROGRESS_PREFIX + deckId, {});
}

export function saveProgress(deckId: string, progress: Record<string, CardProgress>) {
  write(PROGRESS_PREFIX + deckId, progress);
}
