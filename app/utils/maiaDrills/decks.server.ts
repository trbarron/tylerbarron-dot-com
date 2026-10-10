// Storage and validation for Maia Drills decks.
//
// Same ownership model as the Media Profile share cards: saving mints an opaque
// id plus a secret edit token, and only the token can favorite or unfavorite.
// Decks are readable by id. Unfavorited decks expire; favoriting persists the
// deck and adds it to one global favorites list that every visitor sees, so it
// can be reopened from any device without reprocessing.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getRedisClient } from '~/utils/redis.server';
import {
  LIMITS,
  type AnalysisSettings,
  type Deck,
  type DeckStats,
  type DeckSummary,
  type DrillCard,
  type GameSource,
  type Speed,
} from './types';

const DECK_PREFIX = 'maiaDrills:deck:';
const EDIT_PREFIX = 'maiaDrills:edit:';
/** ZSET of favorited deck ids, scored by when they were favorited. */
const FAVORITES_KEY = 'maiaDrills:favorites';

/** Unfavorited decks: long enough to come back to, short enough not to pile up. */
const DECK_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Size of the global favorites list. Favoriting past it drops the oldest
 * favorite, which goes back to expiring like any other deck: nothing is ever
 * blocked, and nothing is kept forever without being on the list.
 */
export const MAX_FAVORITES = 50;

/** ~400 cards at roughly 600 bytes each, with headroom. */
export const MAX_BODY_BYTES = 512 * 1024;

const SOURCES: GameSource[] = ['lichess', 'chesscom'];
const SPEEDS: Speed[] = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence', 'unknown'];

const ID_RE = /^[A-Za-z0-9_-]{12}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{1,40}$/;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const SAN_RE = /^[A-Za-z0-9+#=\-x]{2,10}$/;
// Shape only: six fields, piece placement of 8 ranks.
const FEN_RE = /^([pnbrqkPNBRQK1-8]{1,8}\/){7}[pnbrqkPNBRQK1-8]{1,8} [wb] (-|[KQkq]{1,4}) (-|[a-h][36]) \d+ \d+$/;

export function isValidId(id: string): boolean {
  return ID_RE.test(id);
}

export function isValidEditToken(token: string): boolean {
  return TOKEN_RE.test(token);
}

/** Lichess and Chess.com usernames are case-insensitive. */
function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ── Validation ─────────────────────────────────────────────────────────────

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

function validateSettings(raw: unknown): AnalysisSettings | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { delta, thresholdCp, depth, skipMoves } = raw as Record<string, unknown>;
  if (!isInt(delta, LIMITS.delta.min, LIMITS.delta.max)) return null;
  if (!isInt(thresholdCp, LIMITS.thresholdCp.min, LIMITS.thresholdCp.max)) return null;
  if (!isInt(depth, LIMITS.depth.min, LIMITS.depth.max)) return null;
  if (!isInt(skipMoves, LIMITS.skipMoves.min, LIMITS.skipMoves.max)) return null;
  return { delta, thresholdCp, depth, skipMoves };
}

function validateStats(raw: unknown): DeckStats | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { games, positions, disagreements } = raw as Record<string, unknown>;
  if (!isInt(games, 0, 10_000) || !isInt(positions, 0, 1_000_000) || !isInt(disagreements, 0, 1_000_000)) return null;
  return { games, positions, disagreements };
}

function validMove(raw: unknown): { uci: string; san: string } | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { uci, san } = raw as Record<string, unknown>;
  if (typeof uci !== 'string' || !UCI_RE.test(uci)) return null;
  if (typeof san !== 'string' || !SAN_RE.test(san)) return null;
  return { uci, san };
}

function validateCard(raw: unknown): DrillCard | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Record<string, unknown>;
  const played = validMove(c.played);
  const target = validMove(c.target);
  const prob = (c.target as Record<string, unknown> | undefined)?.prob;

  if (typeof c.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}-\d{1,4}$/.test(c.id)) return null;
  if (typeof c.fen !== 'string' || !FEN_RE.test(c.fen)) return null;
  if (!isInt(c.ply, 0, 2000)) return null;
  if (c.color !== 'w' && c.color !== 'b') return null;
  if (!played || !target) return null;
  if (typeof prob !== 'number' || !(prob >= 0 && prob <= 1)) return null;
  for (const k of ['evalPlayed', 'evalTarget'] as const) if (!isInt(c[k], -1000, 1000)) return null;
  for (const k of ['userElo', 'targetElo', 'oppElo'] as const) if (!isInt(c[k], 0, 4000)) return null;
  if (typeof c.opponent !== 'string' || c.opponent.length > 60) return null;
  if (c.gameUrl !== undefined && (typeof c.gameUrl !== 'string' || !/^https:\/\/[^\s]{1,200}$/.test(c.gameUrl))) return null;
  if (c.playedAt !== undefined && !isInt(c.playedAt, 0, 9_999_999_999_999)) return null;
  if (typeof c.speed !== 'string' || !SPEEDS.includes(c.speed as Speed)) return null;

  return {
    id: c.id,
    fen: c.fen,
    ply: c.ply as number,
    color: c.color,
    played,
    target: { ...target, prob },
    evalPlayed: c.evalPlayed as number,
    evalTarget: c.evalTarget as number,
    userElo: c.userElo as number,
    targetElo: c.targetElo as number,
    oppElo: c.oppElo as number,
    opponent: c.opponent,
    gameUrl: c.gameUrl as string | undefined,
    playedAt: c.playedAt as number | undefined,
    speed: c.speed as Speed,
  };
}

function validateCards(cards: unknown, { allowEmpty }: { allowEmpty: boolean }): ValidationResult<DrillCard[]> {
  if (!Array.isArray(cards) || (cards.length === 0 && !allowEmpty)) {
    return { ok: false, error: 'A deck needs at least one card.' };
  }
  if (cards.length > LIMITS.cardsPerDeck) {
    return { ok: false, error: `A deck holds at most ${LIMITS.cardsPerDeck} cards.` };
  }
  const validCards: DrillCard[] = [];
  const seen = new Set<string>();
  for (const raw of cards) {
    const card = validateCard(raw);
    if (!card) return { ok: false, error: 'A card is malformed.' };
    if (seen.has(card.id)) return { ok: false, error: 'Duplicate card id.' };
    seen.add(card.id);
    validCards.push(card);
  }
  return { ok: true, value: validCards };
}

/** ms since epoch, sanity-bounded; `undefined` passes as "not known". */
function validTimestamp(value: unknown): value is number | undefined {
  return value === undefined || isInt(value, 0, 9_999_999_999_999);
}

/** Validate a deck submitted for saving. Rebuilds it field by field, so unknown keys never reach Redis. */
export function validateDeck(body: unknown): ValidationResult<Deck> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Body must be an object.' };
  const { source, username, settings, stats, cards, excludeBullet, newestGameAt } = body as Record<string, unknown>;

  if (typeof source !== 'string' || !SOURCES.includes(source as GameSource)) {
    return { ok: false, error: 'Unknown game source.' };
  }
  if (typeof username !== 'string' || !USERNAME_RE.test(username.trim())) {
    return { ok: false, error: 'Username must be 1–40 letters, digits, or _ . -' };
  }
  const validSettings = validateSettings(settings);
  if (!validSettings) return { ok: false, error: 'Settings are out of range.' };
  const validStats = validateStats(stats);
  if (!validStats) return { ok: false, error: 'Malformed stats.' };
  if (excludeBullet !== undefined && typeof excludeBullet !== 'boolean') {
    return { ok: false, error: '"excludeBullet" must be true or false.' };
  }
  if (!validTimestamp(newestGameAt)) return { ok: false, error: 'Malformed "newestGameAt".' };
  const validCards = validateCards(cards, { allowEmpty: false });
  if (!validCards.ok) return validCards;

  return {
    ok: true,
    value: {
      v: 1,
      source: source as GameSource,
      username: normalizeUsername(username),
      settings: validSettings,
      stats: validStats,
      cards: validCards.value,
      createdAt: new Date().toISOString(),
      ...(excludeBullet !== undefined && { excludeBullet }),
      ...(newestGameAt !== undefined && { newestGameAt }),
    },
  };
}

/** New games' worth of cards for an existing deck. */
export interface DeckAddition {
  cards: DrillCard[];
  stats: DeckStats;
  newestGameAt?: number;
}

/** Validate the cards and stats sent to add to a deck. No cards is fine: the new games may have had no errors. */
export function validateAddition(body: unknown): ValidationResult<DeckAddition> {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Body must be an object.' };
  const { cards, stats, newestGameAt } = body as Record<string, unknown>;
  const validStats = validateStats(stats);
  if (!validStats) return { ok: false, error: 'Malformed stats.' };
  if (!validTimestamp(newestGameAt)) return { ok: false, error: 'Malformed "newestGameAt".' };
  const validCards = validateCards(cards, { allowEmpty: true });
  if (!validCards.ok) return validCards;
  return { ok: true, value: { cards: validCards.value, stats: validStats, newestGameAt } };
}

const lossOf = (card: DrillCard) => card.evalTarget - card.evalPlayed;

/**
 * Fold new cards into a deck. Cards already in it (same game and ply) are
 * skipped; past the size cap the smallest misses go, old or new. Returns how
 * many new cards made it in.
 */
export function mergeIntoDeck(deck: Deck, addition: DeckAddition, now: Date): { deck: Deck; added: number } {
  const existing = new Set(deck.cards.map((c) => c.id));
  const fresh = addition.cards.filter((c) => !existing.has(c.id));
  const cards = [...deck.cards, ...fresh]
    .sort((a, b) => lossOf(b) - lossOf(a))
    .slice(0, LIMITS.cardsPerDeck);
  const kept = new Set(cards.map((c) => c.id));

  const newest = [deck.newestGameAt, addition.newestGameAt].filter((t): t is number => t !== undefined);
  return {
    deck: {
      ...deck,
      cards,
      stats: {
        games: deck.stats.games + addition.stats.games,
        positions: deck.stats.positions + addition.stats.positions,
        disagreements: deck.stats.disagreements + addition.stats.disagreements,
      },
      newestGameAt: newest.length ? Math.max(...newest) : undefined,
      updatedAt: now.toISOString(),
    },
    added: fresh.filter((c) => kept.has(c.id)).length,
  };
}

// ── Redis ──────────────────────────────────────────────────────────────────

export async function saveDeck(deck: Deck): Promise<{ id: string; editToken: string }> {
  const redis = getRedisClient();
  const editToken = randomBytes(24).toString('base64url');

  // 9 random bytes → 12 url-safe chars; retry on the (vanishing) chance of a clash.
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = randomBytes(9).toString('base64url');
    const stored = await redis.set(`${DECK_PREFIX}${id}`, JSON.stringify(deck), 'EX', DECK_TTL_SECONDS, 'NX');
    if (stored === 'OK') {
      await redis.set(`${EDIT_PREFIX}${id}`, hashToken(editToken), 'EX', DECK_TTL_SECONDS);
      return { id, editToken };
    }
  }
  throw new Error('Could not allocate a deck id');
}

export async function loadDeck(id: string): Promise<Deck | null> {
  const raw = await getRedisClient().get(`${DECK_PREFIX}${id}`);
  return raw ? (JSON.parse(raw) as Deck) : null;
}

export type FavoriteOutcome = 'ok' | 'not-found' | 'forbidden';

/** The stored deck JSON when `editToken` owns deck `id`; otherwise why not. */
async function authorize(id: string, editToken: string): Promise<{ raw: string } | { denied: 'not-found' | 'forbidden' }> {
  const [raw, storedHash] = await getRedisClient().mget(`${DECK_PREFIX}${id}`, `${EDIT_PREFIX}${id}`);
  if (!raw || !storedHash) return { denied: 'not-found' };

  const expected = Buffer.from(storedHash, 'hex');
  const given = Buffer.from(hashToken(editToken), 'hex');
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { denied: 'forbidden' };
  return { raw };
}

/** Take a deck off the list and give it back its expiry. */
async function unlist(id: string, raw: string | null): Promise<void> {
  const redis = getRedisClient();
  const tx = redis.multi().zrem(FAVORITES_KEY, id).expire(`${EDIT_PREFIX}${id}`, DECK_TTL_SECONDS);
  if (raw) {
    const deck = JSON.parse(raw) as Deck;
    delete deck.favorite;
    tx.set(`${DECK_PREFIX}${id}`, JSON.stringify(deck), 'EX', DECK_TTL_SECONDS);
  }
  await tx.exec();
}

export async function setFavorite(id: string, editToken: string, favorite: boolean): Promise<FavoriteOutcome> {
  const redis = getRedisClient();
  const auth = await authorize(id, editToken);
  if ('denied' in auth) return auth.denied;
  const { raw } = auth;

  if (!favorite) {
    await unlist(id, raw);
    return 'ok';
  }

  const deck = JSON.parse(raw) as Deck;
  deck.favorite = true;
  await redis
    .multi()
    .set(`${DECK_PREFIX}${id}`, JSON.stringify(deck))
    .persist(`${EDIT_PREFIX}${id}`)
    .zadd(FAVORITES_KEY, Date.now(), id)
    .exec();

  // Over the cap: the oldest favorites fall off and start expiring again.
  const overflow = (await redis.zcard(FAVORITES_KEY)) - MAX_FAVORITES;
  if (overflow > 0) {
    const oldest = await redis.zrange(FAVORITES_KEY, 0, overflow - 1);
    const raws = await redis.mget(oldest.map((old) => `${DECK_PREFIX}${old}`));
    await Promise.all(oldest.map((old, i) => unlist(old, raws[i])));
  }
  return 'ok';
}

/** The global favorites list, most recently favorited first. */
export async function listFavorites(): Promise<DeckSummary[]> {
  const redis = getRedisClient();
  const ids = await redis.zrevrange(FAVORITES_KEY, 0, MAX_FAVORITES - 1);
  if (ids.length === 0) return [];

  const raws = await redis.mget(ids.map((id) => `${DECK_PREFIX}${id}`));
  const summaries: DeckSummary[] = [];
  const missing: string[] = [];

  raws.forEach((raw, i) => {
    if (!raw) {
      missing.push(ids[i]);
      return;
    }
    const deck = JSON.parse(raw) as Deck;
    summaries.push({
      id: ids[i],
      username: deck.username,
      source: deck.source,
      settings: deck.settings,
      stats: deck.stats,
      cardCount: deck.cards.length,
      createdAt: deck.createdAt,
    });
  });

  // Self-heal an index entry whose deck is gone.
  if (missing.length) await redis.zrem(FAVORITES_KEY, ...missing);
  return summaries;
}

export type AddOutcome =
  | { outcome: 'ok'; added: number; cardCount: number; newestGameAt?: number }
  | { outcome: 'not-found' }
  | { outcome: 'forbidden' };

/**
 * Merge new cards into a deck the caller owns. Adding counts as use, so an
 * unfavorited deck's 30 days start over; a favorite stays permanent.
 *
 * Read-modify-write without a lock: two adds racing on one deck would lose
 * one's cards. Only the browser holding the token can add, so that's one
 * person double-clicking, and the button is disabled while a run is going.
 */
export async function addToDeck(id: string, editToken: string, addition: DeckAddition): Promise<AddOutcome> {
  const auth = await authorize(id, editToken);
  if ('denied' in auth) return auth.denied === 'forbidden' ? { outcome: 'forbidden' } : { outcome: 'not-found' };

  const { deck, added } = mergeIntoDeck(JSON.parse(auth.raw) as Deck, addition, new Date());
  const redis = getRedisClient();
  if (deck.favorite) {
    await redis.set(`${DECK_PREFIX}${id}`, JSON.stringify(deck));
  } else {
    await redis
      .multi()
      .set(`${DECK_PREFIX}${id}`, JSON.stringify(deck), 'EX', DECK_TTL_SECONDS)
      .expire(`${EDIT_PREFIX}${id}`, DECK_TTL_SECONDS)
      .exec();
  }
  return { outcome: 'ok', added, cardCount: deck.cards.length, newestGameAt: deck.newestGameAt };
}
