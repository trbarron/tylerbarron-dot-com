// Storage and validation for Maia Drills decks.
//
// Same ownership model as the Media Profile share cards: saving mints an opaque
// id plus a secret edit token, and only the token can favorite or unfavorite.
// Decks are readable by id. Unfavorited decks expire; favoriting persists the
// deck and adds it to one global favorites list that every visitor sees, so it
// can be reopened from any device without reprocessing.
//
// Drill progress belongs to the deck, not the browser: a set of completed card
// ids that every device drilling the deck adds to (see markCompleted).

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
import { winDrop } from '~/utils/chess/winChance';

const DECK_PREFIX = 'maiaDrills:deck:';
const EDIT_PREFIX = 'maiaDrills:edit:';
/** HASH of card id → when it was first completed (ms). Lives and dies with its deck. */
const PROGRESS_PREFIX = 'maiaDrills:progress:';
/** ZSET of favorited deck ids, scored by when they were favorited. */
const FAVORITES_KEY = 'maiaDrills:favorites';
/**
 * HASH of favorited deck id → DeckSummary JSON, so the list doesn't read whole
 * decks (up to ~400 KB each). Written on favorite and on adding games, removed
 * on unlist.
 */
const SUMMARIES_KEY = 'maiaDrills:favoriteSummaries';

/** Unfavorited decks: long enough to come back to, short enough not to pile up. */
const DECK_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Size of the global favorites list. Favoriting past it drops the oldest
 * favorite, which goes back to expiring like any other deck: nothing is ever
 * blocked, and nothing is kept forever without being on the list.
 */
export const MAX_FAVORITES = 50;

/** A full deck is ~400 KB stored (~380 bytes a card); room for longer names and fields. */
export const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Most completed ids one deck keeps. A deck holds at most cardsPerDeck cards,
 * but ids of cards later dropped by the cap stay, so allow twice that; past it
 * the deck has been written junk, and further completions are refused.
 */
export const MAX_COMPLETED = LIMITS.cardsPerDeck * 2;

const SOURCES: GameSource[] = ['lichess', 'chesscom'];
const SPEEDS: Speed[] = ['bullet', 'blitz', 'rapid', 'classical', 'correspondence', 'unknown'];

const ID_RE = /^[A-Za-z0-9_-]{12}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{32}$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{1,40}$/;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
/** A card's id: its game's id and the ply. */
export const CARD_ID_RE = /^[A-Za-z0-9_-]{1,40}-\d{1,4}$/;
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
  const { delta, thresholdWin, thresholdCp, alsoGoodWin, depth, skipMoves, skipLost } = raw as Record<string, unknown>;
  if (!isInt(delta, LIMITS.delta.min, LIMITS.delta.max)) return null;
  // A deck has one error threshold: win chance, or cp on decks built before it.
  if ((thresholdWin === undefined) === (thresholdCp === undefined)) return null;
  if (thresholdWin !== undefined && !isInt(thresholdWin, LIMITS.thresholdWin.min, LIMITS.thresholdWin.max)) {
    return null;
  }
  if (thresholdCp !== undefined && !isInt(thresholdCp, LIMITS.thresholdCp.min, LIMITS.thresholdCp.max)) return null;
  if (alsoGoodWin !== undefined && !isInt(alsoGoodWin, LIMITS.alsoGoodWin.min, LIMITS.alsoGoodWin.max)) return null;
  if (!isInt(depth, LIMITS.depth.min, LIMITS.depth.max)) return null;
  if (!isInt(skipMoves, LIMITS.skipMoves.min, LIMITS.skipMoves.max)) return null;
  if (skipLost !== undefined && typeof skipLost !== 'boolean') return null;
  return {
    delta,
    ...(thresholdWin !== undefined && { thresholdWin }),
    ...(thresholdCp !== undefined && { thresholdCp }),
    ...(alsoGoodWin !== undefined && { alsoGoodWin }),
    depth,
    skipMoves,
    ...(skipLost !== undefined && { skipLost }),
  };
}

function validateStats(raw: unknown): DeckStats | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { games, positions, disagreements, lost } = raw as Record<string, unknown>;
  if (!isInt(games, 0, 10_000) || !isInt(positions, 0, 1_000_000) || !isInt(disagreements, 0, 1_000_000)) return null;
  if (lost !== undefined && !isInt(lost, 0, 1_000_000)) return null;
  return { games, positions, disagreements, ...(lost !== undefined && { lost }) };
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

  if (typeof c.id !== 'string' || !CARD_ID_RE.test(c.id)) return null;
  if (typeof c.fen !== 'string' || !FEN_RE.test(c.fen)) return null;
  if (!isInt(c.ply, 0, 2000)) return null;
  if (c.color !== 'w' && c.color !== 'b') return null;
  if (!played || !target) return null;
  if (typeof prob !== 'number' || !(prob >= 0 && prob <= 1)) return null;
  for (const k of ['evalPlayed', 'evalTarget'] as const) if (!isInt(c[k], -1000, 1000)) return null;
  for (const k of ['userElo', 'targetElo', 'oppElo'] as const) if (!isInt(c[k], 0, 4000)) return null;
  if (typeof c.opponent !== 'string' || c.opponent.length > 60) return null;
  if (c.gameUrl !== undefined && (typeof c.gameUrl !== 'string' || !/^https:\/\/[^\s]{1,200}$/.test(c.gameUrl)))
    return null;
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

const lossOf = (card: DrillCard) => winDrop(card.evalTarget, card.evalPlayed);

/**
 * Fold new cards into a deck. Cards already in it (same game and ply) are
 * skipped; past the size cap the smallest misses (by win chance) go, old or new. Returns how
 * many new cards made it in.
 */
export function mergeIntoDeck(deck: Deck, addition: DeckAddition, now: Date): { deck: Deck; added: number } {
  const existing = new Set(deck.cards.map((c) => c.id));
  const fresh = addition.cards.filter((c) => !existing.has(c.id));
  const cards = [...deck.cards, ...fresh].sort((a, b) => lossOf(b) - lossOf(a)).slice(0, LIMITS.cardsPerDeck);
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
        ...((deck.stats.lost ?? addition.stats.lost) !== undefined && {
          lost: (deck.stats.lost ?? 0) + (addition.stats.lost ?? 0),
        }),
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
function tokenMatches(storedHash: string, editToken: string): boolean {
  const expected = Buffer.from(storedHash, 'hex');
  const given = Buffer.from(hashToken(editToken), 'hex');
  return expected.length === given.length && timingSafeEqual(expected, given);
}

async function authorize(
  id: string,
  editToken: string,
): Promise<{ raw: string } | { denied: 'not-found' | 'forbidden' }> {
  const [raw, storedHash] = await getRedisClient().mget(`${DECK_PREFIX}${id}`, `${EDIT_PREFIX}${id}`);
  if (!raw || !storedHash) return { denied: 'not-found' };
  if (!tokenMatches(storedHash, editToken)) return { denied: 'forbidden' };
  return { raw };
}

function summarize(id: string, deck: Deck): DeckSummary {
  return {
    id,
    username: deck.username,
    source: deck.source,
    settings: deck.settings,
    stats: deck.stats,
    cardCount: deck.cards.length,
    createdAt: deck.createdAt,
  };
}

/** Take a deck off the list and give it back its expiry. */
async function unlist(id: string, raw: string | null): Promise<void> {
  const redis = getRedisClient();
  const tx = redis
    .multi()
    .zrem(FAVORITES_KEY, id)
    .hdel(SUMMARIES_KEY, id)
    .expire(`${EDIT_PREFIX}${id}`, DECK_TTL_SECONDS)
    .expire(`${PROGRESS_PREFIX}${id}`, DECK_TTL_SECONDS);
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
    .persist(`${PROGRESS_PREFIX}${id}`)
    .zadd(FAVORITES_KEY, Date.now(), id)
    .hset(SUMMARIES_KEY, id, JSON.stringify(summarize(id, deck)))
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

/**
 * The global favorites list, most recently favorited first. Reads the stored
 * summaries, plus an EXISTS per deck in the same round trip so an entry whose
 * deck is gone drops off. A favorite saved before summaries existed is
 * summarized from its deck once and stored.
 */
export async function listFavorites(): Promise<DeckSummary[]> {
  const redis = getRedisClient();
  const ids = await redis.zrevrange(FAVORITES_KEY, 0, MAX_FAVORITES - 1);
  if (ids.length === 0) return [];

  const tx = redis.multi().hmget(SUMMARIES_KEY, ...ids);
  for (const id of ids) tx.exists(`${DECK_PREFIX}${id}`);
  const results = (await tx.exec()) ?? [];
  const stored = (results[0]?.[1] as (string | null)[] | undefined) ?? [];
  const exists = results.slice(1).map((r) => r?.[1] === 1);

  const gone = ids.filter((_, i) => !exists[i]);
  const unsummarized = ids.filter((id, i) => exists[i] && !stored[i]);
  const backfilled = new Map<string, DeckSummary>();
  if (unsummarized.length) {
    const raws = await redis.mget(unsummarized.map((id) => `${DECK_PREFIX}${id}`));
    const backfill = redis.multi();
    raws.forEach((raw, i) => {
      if (!raw) return;
      const summary = summarize(unsummarized[i], JSON.parse(raw) as Deck);
      backfilled.set(summary.id, summary);
      backfill.hset(SUMMARIES_KEY, summary.id, JSON.stringify(summary));
    });
    await backfill.exec();
  }
  if (gone.length)
    await redis
      .multi()
      .zrem(FAVORITES_KEY, ...gone)
      .hdel(SUMMARIES_KEY, ...gone)
      .exec();

  return ids.flatMap((id, i) => {
    if (!exists[i]) return [];
    const summary = stored[i] ? (JSON.parse(stored[i]!) as DeckSummary) : backfilled.get(id);
    return summary ? [summary] : [];
  });
}

export type AddOutcome =
  | { outcome: 'ok'; added: number; cardCount: number; newestGameAt?: number }
  | { outcome: 'not-found' }
  | { outcome: 'forbidden' };

/**
 * Merge new cards into a deck. Favorites are communal, so anyone can add
 * newer games to one; any other deck needs its owner's token. Adding counts
 * as use, so an unfavorited deck's 30 days start over; a favorite stays
 * permanent.
 *
 * The server can't check that cards really came from the player's games, so
 * someone could push junk into a favorite. Accepted for a small site; adds
 * are rate-limited per address.
 *
 * Read-modify-write without a lock: two adds landing on one deck within the
 * same moment would lose one's cards. Each add follows minutes of analysis,
 * so that needs two people finishing at once on the same deck.
 */
export async function addToDeck(id: string, editToken: string | null, addition: DeckAddition): Promise<AddOutcome> {
  const redis = getRedisClient();
  const [raw, storedHash] = await redis.mget(`${DECK_PREFIX}${id}`, `${EDIT_PREFIX}${id}`);
  if (!raw || !storedHash) return { outcome: 'not-found' };
  const current = JSON.parse(raw) as Deck;
  if (!current.favorite && !(editToken && tokenMatches(storedHash, editToken))) return { outcome: 'forbidden' };

  const { deck, added } = mergeIntoDeck(current, addition, new Date());
  if (deck.favorite) {
    await redis
      .multi()
      .set(`${DECK_PREFIX}${id}`, JSON.stringify(deck))
      .hset(SUMMARIES_KEY, id, JSON.stringify(summarize(id, deck)))
      .exec();
  } else {
    await redis
      .multi()
      .set(`${DECK_PREFIX}${id}`, JSON.stringify(deck), 'EX', DECK_TTL_SECONDS)
      .expire(`${EDIT_PREFIX}${id}`, DECK_TTL_SECONDS)
      .expire(`${PROGRESS_PREFIX}${id}`, DECK_TTL_SECONDS)
      .exec();
  }
  return { outcome: 'ok', added, cardCount: deck.cards.length, newestGameAt: deck.newestGameAt };
}

// ── Drill progress ──────────────────────────────────────────────────────────
//
// Anyone who can open a deck can record progress on it, the way anyone can add
// games to a favorite: there are no accounts, and the point is that a phone and
// a laptop share it. So a favorite's progress is shared by everyone drilling it.

/** Every completed card id, or null when the deck is gone. */
export async function loadCompleted(id: string): Promise<string[] | null> {
  const results = await getRedisClient().multi().exists(`${DECK_PREFIX}${id}`).hkeys(`${PROGRESS_PREFIX}${id}`).exec();
  if (!results || results[0][1] !== 1) return null;
  return results[1][1] as string[];
}

export type ProgressOutcome = { outcome: 'ok'; completed: string[] } | { outcome: 'not-found' } | { outcome: 'full' };

/**
 * Mark cards completed and return every completed id. HSETNX per card: the
 * first completion stands and nothing overwrites it, so two sessions (two tabs,
 * a phone and a laptop) can only add to each other's progress, never undo it. A
 * later wrong answer doesn't clear a card either; only resetCompleted does.
 *
 * The progress key takes the deck's expiry: none while it's a favorite,
 * otherwise whatever the deck has left.
 */
export async function markCompleted(id: string, cardIds: string[]): Promise<ProgressOutcome> {
  const redis = getRedisClient();
  const key = `${PROGRESS_PREFIX}${id}`;
  const [ttl, count] = await Promise.all([redis.ttl(`${DECK_PREFIX}${id}`), redis.hlen(key)]);
  if (ttl === -2) return { outcome: 'not-found' };
  if (count >= MAX_COMPLETED) return { outcome: 'full' };

  const at = String(Date.now());
  const tx = redis.multi();
  for (const cardId of cardIds) tx.hsetnx(key, cardId, at);
  if (ttl === -1) tx.persist(key);
  else tx.expire(key, ttl);
  tx.hkeys(key);
  const results = (await tx.exec()) ?? [];
  const failed = results.find(([error]) => error);
  if (failed) throw failed[0];
  return { outcome: 'ok', completed: results[results.length - 1][1] as string[] };
}

/** Clear a deck's progress: the Deck cleared screen's "Reset and start again". */
export async function resetCompleted(id: string): Promise<'ok' | 'not-found'> {
  const results = await getRedisClient().multi().exists(`${DECK_PREFIX}${id}`).del(`${PROGRESS_PREFIX}${id}`).exec();
  return results && results[0][1] === 1 ? 'ok' : 'not-found';
}

/** How many cards each deck has completed, in one round trip, for the favorites list. */
export async function completedCounts(ids: string[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const tx = getRedisClient().multi();
  for (const id of ids) tx.hlen(`${PROGRESS_PREFIX}${id}`);
  const results = (await tx.exec()) ?? [];
  return ids.map((_, i) => Number(results[i]?.[1] ?? 0));
}
