/**
 * Tests for /api/maiaDrills/decks against a small in-memory Redis, so the
 * assertions are about behavior (a favorite stops expiring and shows up in the
 * player's list) rather than which commands ran.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { createActionArgs, createLoaderArgs } from '../setup';
import { action, loader } from '~/routes/api/maiaDrills/decks';
import { MAX_FAVORITES, mergeIntoDeck } from '~/utils/maiaDrills/decks.server';
import type { Deck, DrillCard } from '~/utils/maiaDrills/types';

// ── In-memory Redis: just the commands the deck store and rate limiter use ──

class FakeRedis {
  strings = new Map<string, string>();
  zsets = new Map<string, Map<string, number>>();
  ttls = new Map<string, number>();
  failing = false;

  private check() {
    if (this.failing) throw new Error('connection lost');
  }

  async get(key: string) {
    this.check();
    return this.strings.get(key) ?? null;
  }
  async mget(...keys: (string | string[])[]) {
    this.check();
    return keys.flat().map((k) => this.strings.get(k) ?? null);
  }
  async set(key: string, value: string, ...args: (string | number)[]) {
    this.check();
    if (args.includes('NX') && this.strings.has(key)) return null;
    this.strings.set(key, value);
    const ex = args.indexOf('EX');
    if (ex >= 0) this.ttls.set(key, Number(args[ex + 1]));
    else this.ttls.delete(key);
    return 'OK';
  }
  async incr(key: string) {
    this.check();
    const n = Number(this.strings.get(key) ?? 0) + 1;
    this.strings.set(key, String(n));
    return n;
  }
  async expire(key: string, seconds: number) {
    this.ttls.set(key, seconds);
    return 1;
  }
  async persist(key: string) {
    this.ttls.delete(key);
    return 1;
  }
  private zset(key: string) {
    if (!this.zsets.has(key)) this.zsets.set(key, new Map());
    return this.zsets.get(key)!;
  }
  async zadd(key: string, score: number, member: string) {
    this.zset(key).set(member, score);
    return 1;
  }
  async zrem(key: string, ...members: string[]) {
    members.forEach((m) => this.zset(key).delete(m));
    return members.length;
  }
  async zscore(key: string, member: string) {
    const score = this.zset(key).get(member);
    return score === undefined ? null : String(score);
  }
  async zcard(key: string) {
    return this.zset(key).size;
  }
  async zrange(key: string, start: number, stop: number) {
    return [...this.zset(key).entries()]
      .sort((a, b) => a[1] - b[1])
      .map(([m]) => m)
      .slice(start, stop + 1);
  }
  async zrevrange(key: string, start: number, stop: number) {
    return [...this.zset(key).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([m]) => m)
      .slice(start, stop + 1);
  }
  /** Queues calls and runs them in order on exec(), like a MULTI block. */
  multi() {
    const queued: (() => Promise<unknown>)[] = [];
    const chain = new Proxy(
      {},
      {
        get: (_t, name: string) => {
          if (name === 'exec') return async () => Promise.all(queued.map((run) => run()));
          return (...args: unknown[]) => {
            queued.push(() => (this as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[name](...args));
            return chain;
          };
        },
      }
    );
    return chain;
  }
}

let redis: FakeRedis;
vi.mock('~/utils/redis.server', () => ({ getRedisClient: () => redis }));

// ── Helpers ────────────────────────────────────────────────────────────────

const card: DrillCard = {
  id: 'abc123-4',
  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
  ply: 4,
  color: 'w',
  played: { uci: 'a2a3', san: 'a3' },
  target: { uci: 'f1b5', san: 'Bb5', prob: 0.41 },
  evalPlayed: 10,
  evalTarget: 180,
  userElo: 1500,
  targetElo: 1700,
  oppElo: 1480,
  opponent: 'them',
  gameUrl: 'https://lichess.org/abc123',
  speed: 'blitz',
};

const deckBody = {
  source: 'lichess',
  username: 'Tyler',
  settings: { delta: 200, thresholdCp: 150, depth: 12, skipMoves: 0 },
  stats: { games: 1, positions: 30, disagreements: 12 },
  cards: [card],
};

const URL_BASE = '/api/maiaDrills/decks';

async function post(body: unknown, ip = '1.1.1.1') {
  const res = await action(
    createActionArgs(URL_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    })
  );
  return { status: res.status, body: await res.json() };
}

async function put(body: unknown) {
  const res = await action(
    createActionArgs(URL_BASE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, body: await res.json() };
}

async function patch(body: unknown) {
  const res = await action(
    createActionArgs(URL_BASE, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, body: await res.json() };
}

async function get(query: string) {
  const res = await loader(createLoaderArgs(`${URL_BASE}?${query}`));
  return { status: res.status, body: await res.json() };
}

async function saved(ip?: string) {
  const { body } = await post(deckBody, ip);
  return body as { id: string; editToken: string };
}

beforeEach(() => {
  redis = new FakeRedis();
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/maiaDrills/decks', () => {
  it('saves a deck that expires, and returns an id and edit token', async () => {
    const { status, body } = await post(deckBody);
    expect(status).toBe(201);
    expect(body.id).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(body.editToken).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(redis.ttls.get(`maiaDrills:deck:${body.id}`)).toBe(30 * 24 * 60 * 60);
    // The token is stored hashed, never as given.
    expect(redis.strings.get(`maiaDrills:edit:${body.id}`)).not.toContain(body.editToken);
  });

  it('rejects an invalid deck', async () => {
    const { status } = await post({ ...deckBody, cards: [] });
    expect(status).toBe(400);
  });

  it('rejects a body that is not JSON', async () => {
    expect((await post('{nope')).status).toBe(400);
  });

  it('rejects an oversized body before parsing it', async () => {
    expect((await post('x'.repeat(600 * 1024))).status).toBe(413);
  });

  it('rate-limits saves per address', async () => {
    for (let i = 0; i < 20; i++) expect((await post(deckBody, '9.9.9.9')).status).toBe(201);
    expect((await post(deckBody, '9.9.9.9')).status).toBe(429);
    expect((await post(deckBody, '8.8.8.8')).status).toBe(201);
  });

  it('answers 503 when Redis is down', async () => {
    redis.failing = true;
    expect((await post(deckBody)).status).toBe(503);
  });
});

describe('GET /api/maiaDrills/decks?id=', () => {
  it('reads a saved deck back', async () => {
    const { id } = await saved();
    const { status, body } = await get(`id=${id}`);
    expect(status).toBe(200);
    expect(body.deck.username).toBe('tyler');
    expect(body.deck.cards).toEqual([card]);
  });

  it('404s an unknown id and 400s a malformed one', async () => {
    expect((await get('id=AAAAAAAAAAAA')).status).toBe(404);
    expect((await get('id=../../etc')).status).toBe(400);
  });
});

describe('favorites', () => {
  /** Favorite order is by time; step the clock so each favorite is distinct. */
  let now = 1_800_000_000_000;
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockImplementation(() => (now += 1000));
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses a favorite without the right token', async () => {
    const { id } = await saved();
    expect((await put({ id, editToken: 'x'.repeat(32), favorite: true })).status).toBe(403);
    expect((await put({ id, editToken: 'short', favorite: true })).status).toBe(403);
  });

  it('keeps a favorited deck forever and lists it for everyone', async () => {
    const { id, editToken } = await saved();
    const { status, body } = await put({ id, editToken, favorite: true });
    expect(status).toBe(200);
    expect(body).toEqual({ id, favorite: true });
    expect(redis.ttls.has(`maiaDrills:deck:${id}`)).toBe(false);
    expect(redis.ttls.has(`maiaDrills:edit:${id}`)).toBe(false);

    const list = await get('');
    expect(list.status).toBe(200);
    expect(list.body.decks).toEqual([
      expect.objectContaining({ id, username: 'tyler', source: 'lichess', cardCount: 1, settings: deckBody.settings }),
    ]);
    expect((await get(`id=${id}`)).body.deck.favorite).toBe(true);
  });

  it('lists the most recently favorited first, whoever built them', async () => {
    const first = await saved();
    const second = await post({ ...deckBody, source: 'chesscom', username: 'Someone' }, '2.2.2.2');
    await put({ id: second.body.id, editToken: second.body.editToken, favorite: true });
    await put({ id: first.id, editToken: first.editToken, favorite: true });
    const { body } = await get('');
    expect(body.decks.map((d: { username: string }) => d.username)).toEqual(['tyler', 'someone']);
  });

  it('unfavoriting removes it from the list and restores the expiry', async () => {
    const { id, editToken } = await saved();
    await put({ id, editToken, favorite: true });
    await put({ id, editToken, favorite: false });
    expect((await get('')).body.decks).toEqual([]);
    expect(redis.ttls.get(`maiaDrills:deck:${id}`)).toBe(30 * 24 * 60 * 60);
    expect((await get(`id=${id}`)).body.deck.favorite).toBeUndefined();
  });

  it(`keeps the newest ${MAX_FAVORITES}; the oldest falls off and expires again`, async () => {
    const decks = [];
    // Separate addresses, so the save rate limit isn't what this hits.
    for (let i = 0; i < MAX_FAVORITES + 1; i++) decks.push(await saved(`10.0.${Math.floor(i / 10)}.${i}`));
    for (const d of decks) {
      expect((await put({ id: d.id, editToken: d.editToken, favorite: true })).status).toBe(200);
    }

    const listed = (await get('')).body.decks.map((d: { id: string }) => d.id);
    expect(listed).toHaveLength(MAX_FAVORITES);
    expect(listed).not.toContain(decks[0].id);
    expect(listed[0]).toBe(decks[MAX_FAVORITES].id);

    const evicted = decks[0].id;
    expect(redis.ttls.get(`maiaDrills:deck:${evicted}`)).toBe(30 * 24 * 60 * 60);
    expect(redis.ttls.get(`maiaDrills:edit:${evicted}`)).toBe(30 * 24 * 60 * 60);
    expect((await get(`id=${evicted}`)).body.deck.favorite).toBeUndefined();
  });

  it('re-favoriting a listed deck moves it to the top without growing the list', async () => {
    const a = await saved();
    const b = await saved('3.3.3.3');
    await put({ id: a.id, editToken: a.editToken, favorite: true });
    await put({ id: b.id, editToken: b.editToken, favorite: true });
    await put({ id: a.id, editToken: a.editToken, favorite: true });
    const listed = (await get('')).body.decks.map((d: { id: string }) => d.id);
    expect(listed).toEqual([a.id, b.id]);
  });

  it('drops list entries whose deck is gone', async () => {
    const { id, editToken } = await saved();
    await put({ id, editToken, favorite: true });
    redis.strings.delete(`maiaDrills:deck:${id}`);
    expect((await get('')).body.decks).toEqual([]);
    expect(await redis.zcard('maiaDrills:favorites')).toBe(0);
  });

  it('404s favoriting an expired deck', async () => {
    expect((await put({ id: 'AAAAAAAAAAAA', editToken: 'x'.repeat(32), favorite: true })).status).toBe(404);
  });
});

// ── Adding games ───────────────────────────────────────────────────────────

/** A card from another game, missing by `loss` cp. */
const cardFrom = (gameId: string, loss: number): DrillCard => ({ ...card, id: `${gameId}-4`, evalTarget: loss, evalPlayed: 0 });

describe('mergeIntoDeck', () => {
  const deck = { ...deckBody, v: 1, createdAt: '2026-10-01T00:00:00Z', newestGameAt: 1000, cards: [card] } as Deck;
  const now = new Date('2026-10-10T00:00:00Z');

  it('adds new cards, skips ones already in the deck, and sums the stats', () => {
    const { deck: merged, added } = mergeIntoDeck(
      deck,
      { cards: [card, cardFrom('newgame1', 300)], stats: { games: 5, positions: 100, disagreements: 40 }, newestGameAt: 5000 },
      now
    );
    expect(added).toBe(1);
    expect(merged.cards.map((c) => c.id)).toEqual(['newgame1-4', 'abc123-4']);
    expect(merged.stats).toEqual({ games: 6, positions: 130, disagreements: 52 });
    expect(merged.newestGameAt).toBe(5000);
    expect(merged.updatedAt).toBe(now.toISOString());
  });

  it('sums the already-lost count when either side has one', () => {
    const stats = { games: 1, positions: 10, disagreements: 4, lost: 2 };
    expect(mergeIntoDeck(deck, { cards: [], stats }, now).deck.stats.lost).toBe(2);
    const both = { ...deck, stats: { ...deck.stats, lost: 3 } };
    expect(mergeIntoDeck(both, { cards: [], stats }, now).deck.stats.lost).toBe(5);
  });

  it('never moves the newest-game date backwards', () => {
    const { deck: merged } = mergeIntoDeck(deck, { cards: [], stats: { games: 0, positions: 0, disagreements: 0 }, newestGameAt: 10 }, now);
    expect(merged.newestGameAt).toBe(1000);
    const stopped = mergeIntoDeck(deck, { cards: [], stats: { games: 0, positions: 0, disagreements: 0 } }, now);
    expect(stopped.deck.newestGameAt).toBe(1000);
  });

  it('keeps the biggest misses when over the cap, and counts only new cards that made it', () => {
    const full = { ...deck, cards: Array.from({ length: 400 }, (_, i) => cardFrom(`old${i}`, 200 + i)) };
    const { deck: merged, added } = mergeIntoDeck(
      full,
      { cards: [cardFrom('big', 999), cardFrom('small', 150)], stats: { games: 2, positions: 60, disagreements: 20 } },
      now
    );
    expect(merged.cards).toHaveLength(400);
    expect(merged.cards[0].id).toBe('big-4');
    expect(merged.cards.map((c) => c.id)).not.toContain('small-4');
    expect(merged.cards.map((c) => c.id)).not.toContain('old0-4'); // the smallest old miss made room
    expect(added).toBe(1);
  });
});

describe('PATCH /api/maiaDrills/decks', () => {
  const addition = { cards: [cardFrom('newgame1', 300)], stats: { games: 3, positions: 90, disagreements: 30 }, newestGameAt: 1_800_000_000_000 };

  it('merges new cards into a deck the caller owns', async () => {
    const { id, editToken } = await saved();
    const { status, body } = await patch({ id, editToken, ...addition });
    expect(status).toBe(200);
    expect(body).toEqual({ added: 1, cardCount: 2, newestGameAt: addition.newestGameAt });

    const { deck } = (await get(`id=${id}`)).body;
    expect(deck.cards.map((c: DrillCard) => c.id)).toEqual(['newgame1-4', 'abc123-4']);
    expect(deck.stats.games).toBe(4);
  });

  it('accepts no new cards, still moving the newest-game date on', async () => {
    const { id, editToken } = await saved();
    const { status, body } = await patch({ id, editToken, ...addition, cards: [] });
    expect(status).toBe(200);
    expect(body.added).toBe(0);
    expect((await get(`id=${id}`)).body.deck.newestGameAt).toBe(addition.newestGameAt);
  });

  it('refuses a caller without the deck’s token, unless the deck is a favorite', async () => {
    const { id } = await saved();
    expect((await patch({ id, editToken: 'x'.repeat(32), ...addition })).status).toBe(403);
    expect((await patch({ id, ...addition })).status).toBe(403);
    expect((await get(`id=${id}`)).body.deck.cards).toHaveLength(1);
  });

  it('lets anyone add newer games to a favorite, with or without a token', async () => {
    const { id, editToken } = await saved();
    await put({ id, editToken, favorite: true });

    const anonymous = await patch({ id, ...addition });
    expect(anonymous.status).toBe(200);
    expect(anonymous.body.added).toBe(1);

    const wrongToken = await patch({ id, editToken: 'x'.repeat(32), ...addition, cards: [cardFrom('newgame2', 250)] });
    expect(wrongToken.status).toBe(200);
    expect((await get(`id=${id}`)).body.deck.cards).toHaveLength(3);

    // Still only the owner can unfavorite it.
    expect((await put({ id, editToken: 'x'.repeat(32), favorite: false })).status).toBe(403);
  });

  it('404s an expired deck and 400s malformed cards', async () => {
    expect((await patch({ id: 'AAAAAAAAAAAA', editToken: 'x'.repeat(32), ...addition })).status).toBe(404);
    const { id, editToken } = await saved();
    expect((await patch({ id, editToken, ...addition, cards: [{ ...card, fen: 'nope' }] })).status).toBe(400);
    expect((await patch({ id, editToken, ...addition, newestGameAt: -5 })).status).toBe(400);
  });

  it('keeps a favorite permanent, and restarts an unfavorited deck’s 30 days', async () => {
    const fav = await saved();
    await put({ id: fav.id, editToken: fav.editToken, favorite: true });
    await patch({ id: fav.id, editToken: fav.editToken, ...addition });
    expect(redis.ttls.has(`maiaDrills:deck:${fav.id}`)).toBe(false);
    expect((await get(`id=${fav.id}`)).body.deck.favorite).toBe(true);

    const plain = await saved('4.4.4.4');
    redis.ttls.set(`maiaDrills:deck:${plain.id}`, 60);
    await patch({ id: plain.id, editToken: plain.editToken, ...addition });
    expect(redis.ttls.get(`maiaDrills:deck:${plain.id}`)).toBe(30 * 24 * 60 * 60);
  });
});

describe('saving the fields that adding relies on', () => {
  it('keeps excludeBullet and newestGameAt', async () => {
    const { body } = await post({ ...deckBody, excludeBullet: false, newestGameAt: 1_700_000_000_000 });
    const { deck } = (await get(`id=${body.id}`)).body;
    expect(deck).toMatchObject({ excludeBullet: false, newestGameAt: 1_700_000_000_000 });
  });

  it('keeps the already-lost setting and count', async () => {
    const { body } = await post({
      ...deckBody,
      settings: { ...deckBody.settings, skipLost: true },
      stats: { ...deckBody.stats, lost: 4 },
    });
    const { deck } = (await get(`id=${body.id}`)).body;
    expect(deck.settings.skipLost).toBe(true);
    expect(deck.stats.lost).toBe(4);
  });

  it('rejects malformed ones', async () => {
    expect((await post({ ...deckBody, settings: { ...deckBody.settings, skipLost: 'yes' } })).status).toBe(400);
    expect((await post({ ...deckBody, stats: { ...deckBody.stats, lost: -1 } })).status).toBe(400);
    expect((await post({ ...deckBody, excludeBullet: 'yes' })).status).toBe(400);
    expect((await post({ ...deckBody, newestGameAt: 'yesterday' })).status).toBe(400);
  });
});
