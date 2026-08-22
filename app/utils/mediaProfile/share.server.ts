// Storage and validation for shared Media Format Appreciation Profile results.
//
// Results live in the same Redis instance the chess games use. There is no
// account system: saving mints an opaque id plus a secret edit token, and
// holding the token is the only proof of authorship. The id alone is read-only,
// so a shared link cannot be used to rewrite the card it points at — that is
// what keeps one person's card out of everyone else's hands.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getRedisClient } from '~/utils/redis.server';

const KEY_PREFIX = 'mediaProfile:result:';

/** Where the hashed edit token lives. Never read by the loader, only compared. */
const EDIT_KEY_PREFIX = 'mediaProfile:edit:';

/** Sorted set of ids the author marked public, scored by creation time. */
const PUBLIC_KEY = 'mediaProfile:public';

// Sliding, not fixed: a read refreshes the TTL, so a link that people keep
// opening never expires while one nobody has touched in two years is reclaimed.
const TTL_SECONDS = 2 * 365 * 24 * 60 * 60;

/** Ids kept in the public index. Older ones fall off as new cards arrive. */
const PUBLIC_INDEX_MAX = 200;

/** Most cards one call to the public listing will return. */
export const PUBLIC_PAGE_MAX = 50;

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
  /** Author opted this card into the list at the bottom of the post. */
  isPublic?: boolean;
  savedAt: string;
  /** Set only once the author has come back and changed something. */
  updatedAt?: string;
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

  const { scores, notes, broadcaster, name, isPublic } = body as Record<string, unknown>;

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

  if (isPublic !== undefined && typeof isPublic !== 'boolean') {
    return { ok: false, error: '"isPublic" must be true or false.' };
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
      ...(isPublic ? { isPublic: true } : {}),
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

/**
 * The secret that authorises an edit. Long enough not to be guessable at any
 * rate, and never rendered on the page — it lives in the author's localStorage
 * and travels only in the body of their own update request.
 */
export function generateEditToken(): string {
  return randomBytes(24).toString('base64url');
}

/** Shape check for a token, so a junk value never reaches the hash compare. */
export function isValidEditToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{16,128}$/.test(token);
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time compare of two hex digests. */
function digestsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export type UpdateOutcome = 'ok' | 'not-found' | 'forbidden';

export async function saveResult(
  result: MediaProfileResult
): Promise<{ id: string; editToken: string }> {
  const redis = getRedisClient();
  const id = generateId();
  const editToken = generateEditToken();

  await redis
    .multi()
    .set(`${KEY_PREFIX}${id}`, JSON.stringify(result), 'EX', TTL_SECONDS)
    .set(`${EDIT_KEY_PREFIX}${id}`, hashToken(editToken), 'EX', TTL_SECONDS)
    .exec();

  if (result.isPublic) await addToPublicIndex(id, result.savedAt);

  return { id, editToken };
}

/**
 * Overwrite a card in place. The stored creation time wins over whatever the
 * caller sent, so an edit cannot reorder the public list or backdate itself.
 */
export async function updateResult(
  id: string,
  editToken: string,
  result: MediaProfileResult
): Promise<UpdateOutcome> {
  const redis = getRedisClient();

  const [storedHash, existingRaw] = await Promise.all([
    redis.get(`${EDIT_KEY_PREFIX}${id}`),
    redis.get(`${KEY_PREFIX}${id}`),
  ]);

  if (!storedHash || !existingRaw) return 'not-found';
  if (!digestsMatch(storedHash, hashToken(editToken))) return 'forbidden';

  let savedAt = result.savedAt;
  try {
    const existing = JSON.parse(existingRaw) as MediaProfileResult;
    if (typeof existing.savedAt === 'string') savedAt = existing.savedAt;
  } catch {
    // A corrupt payload is still the author's to replace; keep the new date.
  }

  const next: MediaProfileResult = { ...result, savedAt, updatedAt: new Date().toISOString() };

  await redis
    .multi()
    .set(`${KEY_PREFIX}${id}`, JSON.stringify(next), 'EX', TTL_SECONDS)
    .expire(`${EDIT_KEY_PREFIX}${id}`, TTL_SECONDS)
    .exec();

  if (next.isPublic) await addToPublicIndex(id, savedAt);
  else await redis.zrem(PUBLIC_KEY, id);

  return 'ok';
}

async function addToPublicIndex(id: string, savedAt: string): Promise<void> {
  const parsed = Date.parse(savedAt);
  const score = Number.isNaN(parsed) ? Date.now() : parsed;
  await getRedisClient()
    .multi()
    .zadd(PUBLIC_KEY, score, id)
    // Keep the newest N. The index is a display list, not an archive.
    .zremrangebyrank(PUBLIC_KEY, 0, -(PUBLIC_INDEX_MAX + 1))
    .exec();
}

export async function loadResult(id: string): Promise<MediaProfileResult | null> {
  const redis = getRedisClient();
  const key = `${KEY_PREFIX}${id}`;
  const raw = await redis.get(key);
  if (!raw) return null;

  // Refresh the sliding window. A failure here costs the link two years of
  // life at worst, so it must not fail the read.
  refreshTtl([id]);

  try {
    return JSON.parse(raw) as MediaProfileResult;
  } catch {
    console.error(`mediaProfile: unparseable payload at ${key}`);
    return null;
  }
}

/** Push a card and its edit token back out to the full window. Best effort. */
function refreshTtl(ids: string[]): void {
  if (ids.length === 0) return;
  try {
    const pipeline = getRedisClient().pipeline();
    for (const id of ids) {
      pipeline.expire(`${KEY_PREFIX}${id}`, TTL_SECONDS);
      pipeline.expire(`${EDIT_KEY_PREFIX}${id}`, TTL_SECONDS);
    }
    pipeline.exec().catch(() => {});
  } catch {
    // Same bargain as the caller's: a refresh is never worth failing a read.
  }
}

export interface PublicCard {
  id: string;
  result: MediaProfileResult;
}

/**
 * The cards people chose to publish, newest first.
 *
 * Entries whose payload has expired are dropped from the index as they are
 * noticed — there is no sweeper, and a stale id costs one null in an MGET.
 */
export async function listPublicResults(limit: number): Promise<PublicCard[]> {
  const redis = getRedisClient();
  const count = Math.max(1, Math.min(limit, PUBLIC_PAGE_MAX));

  const ids = await redis.zrevrange(PUBLIC_KEY, 0, count - 1);
  if (ids.length === 0) return [];

  const payloads = await redis.mget(ids.map((id) => `${KEY_PREFIX}${id}`));

  const cards: PublicCard[] = [];
  const stale: string[] = [];

  ids.forEach((id, index) => {
    const raw = payloads[index];
    if (!raw) {
      stale.push(id);
      return;
    }
    try {
      const result = JSON.parse(raw) as MediaProfileResult;
      // An author who turned publishing back off may still sit in the index if
      // that ZREM lost a race; the payload is the authority either way.
      if (result.isPublic) cards.push({ id, result });
      else stale.push(id);
    } catch {
      stale.push(id);
    }
  });

  if (stale.length > 0) redis.zrem(PUBLIC_KEY, ...stale).catch(() => {});

  // Anything still on display is still in use.
  refreshTtl(cards.map((card) => card.id));

  return cards;
}
