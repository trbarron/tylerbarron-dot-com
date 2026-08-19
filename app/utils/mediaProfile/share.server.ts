// Storage and validation for shared Media Format Appreciation Profile results.
//
// Results live in the same Redis instance the chess games use. There is no
// account system: saving mints an opaque id, and holding the id is the only
// proof of ownership. Nothing here is editable after the fact, so a leaked id
// exposes a set of self-reported percentages and nothing else.

import { randomBytes } from 'node:crypto';
import { getRedisClient } from '~/utils/redis.server';

const KEY_PREFIX = 'mediaProfile:result:';

// Sliding, not fixed: a read refreshes the TTL, so a link that people keep
// opening never expires while one nobody has touched in a year is reclaimed.
const TTL_SECONDS = 365 * 24 * 60 * 60;

/**
 * The scale ids the client may submit. This list is the validation authority —
 * `posts/mediaFormatAppreciationProfile.mdx` carries its own copy for rendering,
 * because mdx-bundler compiles each post standalone and cannot import from
 * `~/`. Adding a category means editing both, and an id that appears only in
 * the post will be rejected here.
 */
export const SCALE_IDS = [
  'movies',
  'tv',
  'tv.reality',
  'liveSports',
  'music',
  'music.recent',
  'books',
  'books.fiction',
  'books.nonfiction',
  'theater',
  'theater.musicals',
  'theater.plays',
  'poetry',
  'shortForm',
  'longForm',
  'podcasts',
  'podcasts.scripted',
  'podcasts.unscripted',
] as const;

export type ScaleId = (typeof SCALE_IDS)[number];

/** Ids that take a note. Only top-level scales do. */
const NOTE_IDS = new Set<string>(SCALE_IDS.filter((id) => !id.includes('.')));

const SCALE_ID_SET = new Set<string>(SCALE_IDS);

const MAX_NOTE_LENGTH = 280;

/** Names are a display label, not an identity — short is fine. */
const MAX_NAME_LENGTH = 40;

/** Guards against a pathological body before any parsing work happens. */
export const MAX_BODY_BYTES = 8 * 1024;

export interface MediaProfileResult {
  /** Payload version, so a future scale change can migrate old links. */
  v: 1;
  /** Optional display name the sharer attached. Never used as a key. */
  name?: string;
  scores: Partial<Record<ScaleId, number>>;
  notes: Record<string, string>;
  /** The one non-numeric follow-up: "do you have a favorite broadcaster?" */
  broadcaster?: boolean;
  savedAt: string;
}

export type ValidationResult =
  | { ok: true; value: MediaProfileResult }
  | { ok: false; error: string };

/**
 * The sliders move in tenths, so a stored value that is not a multiple of ten
 * did not come from the post. Enforced here as well as in the UI: validation
 * only runs on write, so tightening it cannot invalidate links already saved.
 */
export const SCORE_STEP = 10;

/**
 * Collapse a submitted name to a single line of display text. Control
 * characters and newlines are stripped rather than rejected: someone pasting a
 * name with a stray newline meant no harm, and the value is only ever rendered
 * as text (React escapes it) — never used as a Redis key or in a URL.
 */
function cleanName(value: string): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPercent(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 100 &&
    value % SCORE_STEP === 0
  );
}

/**
 * Validate a submitted result.
 *
 * Deliberately strict: unknown keys are rejected rather than dropped, so a
 * typo in the post surfaces as a 400 during development instead of silently
 * storing a result that renders blank when it is read back.
 */
export function validateResult(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be an object.' };
  }

  const { scores, notes, broadcaster, name } = body as Record<string, unknown>;

  if (typeof scores !== 'object' || scores === null) {
    return { ok: false, error: 'Missing "scores" object.' };
  }

  const cleanScores: Partial<Record<ScaleId, number>> = {};
  for (const [key, value] of Object.entries(scores)) {
    if (!SCALE_ID_SET.has(key)) {
      return { ok: false, error: `Unknown scale "${key}".` };
    }
    if (!isPercent(value)) {
      return {
        ok: false,
        error: `Scale "${key}" must be a multiple of ${SCORE_STEP} from 0 to 100.`,
      };
    }
    cleanScores[key as ScaleId] = value;
  }

  if (Object.keys(cleanScores).length === 0) {
    return { ok: false, error: 'Rate at least one scale before sharing.' };
  }

  const cleanNotes: Record<string, string> = {};
  if (notes !== undefined) {
    if (typeof notes !== 'object' || notes === null) {
      return { ok: false, error: '"notes" must be an object.' };
    }
    for (const [key, value] of Object.entries(notes)) {
      if (!NOTE_IDS.has(key)) {
        return { ok: false, error: `Unknown note "${key}".` };
      }
      if (typeof value !== 'string') {
        return { ok: false, error: `Note "${key}" must be a string.` };
      }
      const trimmed = value.trim();
      if (trimmed.length > MAX_NOTE_LENGTH) {
        return { ok: false, error: `Note "${key}" exceeds ${MAX_NOTE_LENGTH} characters.` };
      }
      if (trimmed) cleanNotes[key] = trimmed;
    }
  }

  if (broadcaster !== undefined && typeof broadcaster !== 'boolean') {
    return { ok: false, error: '"broadcaster" must be true or false.' };
  }

  let cleanedName: string | undefined;
  if (name !== undefined) {
    if (typeof name !== 'string') {
      return { ok: false, error: '"name" must be a string.' };
    }
    const trimmed = cleanName(name);
    if (trimmed.length > MAX_NAME_LENGTH) {
      return { ok: false, error: `Name must be ${MAX_NAME_LENGTH} characters or fewer.` };
    }
    if (trimmed) cleanedName = trimmed;
  }

  return {
    ok: true,
    value: {
      v: 1,
      ...(cleanedName ? { name: cleanedName } : {}),
      scores: cleanScores,
      notes: cleanNotes,
      ...(typeof broadcaster === 'boolean' ? { broadcaster } : {}),
      savedAt: new Date().toISOString(),
    },
  };
}

/**
 * URL-safe id. 10 base32 characters ≈ 50 bits, which is far past the point
 * where guessing one at the endpoint's rate limit is worth anyone's time.
 */
export function generateId(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'; // no l/o/0/1
  const bytes = randomBytes(10);
  let id = '';
  for (const byte of bytes) id += alphabet[byte % alphabet.length];
  return id;
}

/** Shape of an id the loader will accept without touching Redis. */
export function isValidId(id: string): boolean {
  return /^[a-z2-9]{10}$/.test(id);
}

export async function saveResult(result: MediaProfileResult): Promise<string> {
  const redis = getRedisClient();
  const id = generateId();
  await redis.set(`${KEY_PREFIX}${id}`, JSON.stringify(result), 'EX', TTL_SECONDS);
  return id;
}

export async function loadResult(id: string): Promise<MediaProfileResult | null> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX}${id}`;
  const raw = await redis.get(key);
  if (!raw) return null;

  // Refresh the sliding window. A failure here costs the link a year of life
  // at worst, so it must not fail the read.
  redis.expire(key, TTL_SECONDS).catch(() => {});

  try {
    return JSON.parse(raw) as MediaProfileResult;
  } catch {
    console.error(`mediaProfile: unparseable payload at ${key}`);
    return null;
  }
}
