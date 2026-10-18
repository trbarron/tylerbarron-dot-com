/**
 * Collaborative Checkmate's Redis layer (game.server.ts) against a real Redis:
 * the compare-and-set saves, the decision lock, presence and stats, with
 * players acting at the same moment. The fake Redis in tests/api can't run the
 * Lua script, so these need a live one:
 *
 *   TEST_REDIS_URL=redis://localhost:6379 npx vitest run tests/integration/collaborativeCheckmateGame.test.ts
 *
 * Skipped without TEST_REDIS_URL, and refuses anything but a local Redis.
 * Stockfish is stubbed and the clock is faked (Date only).
 */

import Redis from 'ioredis';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getGame, joinGame, listOpenGames, playerAction } from '~/utils/collaborativeCheckmate/game.server';
import { SELECTION_MS, type PublicGame } from '~/utils/collaborativeCheckmate/types';

const url = process.env.TEST_REDIS_URL;
const isLocal = Boolean(url && /^redis:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/\d+)?$/.test(url));
if (url && !isLocal) throw new Error(`TEST_REDIS_URL must be a local Redis, got ${url}`);

const { evaluate, redisRef } = vi.hoisted(() => ({ evaluate: vi.fn(), redisRef: { client: null as Redis | null } }));
vi.mock('~/utils/redis.server', () => ({ getRedisClient: () => redisRef.client }));
vi.mock('~/utils/stockfish.server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/stockfish.server')>()),
  evaluate: (...args: unknown[]) => evaluate(...args),
}));

const PLAYERS = ['ann', 'bo', 'cy', 'di'];
const T0 = new Date('2026-10-18T12:00:00Z').getTime();
let now = T0;
const advance = (ms: number) => {
  now += ms;
  vi.setSystemTime(now);
};
const newId = () => `t-${Math.random().toString(36).slice(2, 10)}`;
const redis = () => redisRef.client!;
const stat = async (field: string) => Number((await redis().hget('collaborativeCheckmate:stats', field)) ?? 0);
const decisions = (g: PublicGame) =>
  g.log.filter((l) => l.type === 'engine' || / plays | agreed: |random/.test(l.message));

async function startedGame(): Promise<string> {
  const id = newId();
  for (const p of PLAYERS) await joinGame(id, p, false);
  for (const p of PLAYERS) await playerAction(id, p, { type: 'ready' });
  return id;
}

/** Everyone polls at once, as the 500 ms loop would after a deadline. */
const pollAll = (id: string, times = 2) =>
  Promise.all(Array.from({ length: times }, () => PLAYERS.map((p) => getGame(id, p))).flat());

describe.skipIf(!isLocal)('collaborativeCheckmate game.server (real Redis)', () => {
  beforeAll(() => {
    redisRef.client = new Redis(url!, { maxRetriesPerRequest: 2 });
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  beforeEach(() => {
    advance(60_000);
    evaluate.mockReset();
    // White's e4 is better for White than anything else: the position after it scores -50 for Black to move.
    evaluate.mockImplementation(async (fen: string) => ({ type: 'cp', value: fen.includes('4P3') ? -50 : 50 }));
  });

  afterAll(async () => {
    vi.useRealTimers();
    const client = redis();
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await client.scan(cursor, 'MATCH', 'collaborativeCheckmate:*:t-*', 'COUNT', 500);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length) await client.del(...keys);
    const open = await client.zrange('collaborativeCheckmate:open', 0, -1);
    const ours = open.filter((id) => id.startsWith('t-'));
    if (ours.length) await client.zrem('collaborativeCheckmate:open', ...ours);
    await client.quit();
  });

  it('seats four players who join at the same moment, each exactly once', async () => {
    const id = newId();
    await Promise.all(PLAYERS.map((p) => joinGame(id, p, false)));
    const game = (await getGame(id, 'ann'))!;
    expect(
      Object.values(game.seats)
        .map((s) => s.player)
        .sort(),
    ).toEqual([...PLAYERS].sort());
  });

  it('starts once when everyone readies at the same moment, and leaves the lobby', async () => {
    const id = newId();
    for (const p of PLAYERS) await joinGame(id, p, false);
    expect((await listOpenGames()).some((g) => g.game_id === id)).toBe(false); // full
    const started = await stat('games_started');
    await Promise.all(PLAYERS.map((p) => playerAction(id, p, { type: 'ready' })));
    await pollAll(id);
    const game = (await getGame(id, 'ann'))!;
    expect(game.phase).toBe('team1_selection');
    expect(game.log.filter((l) => l.message.startsWith('Game on')).length).toBe(1);
    expect(await stat('games_started')).toBe(started + 1);
  });

  it('decides one move when both lock in while everyone polls', async () => {
    const id = await startedGame();
    await playerAction(id, 'ann', { type: 'submit_move', move: 'f2f3' });
    await playerAction(id, 'bo', { type: 'submit_move', move: 'e2e4' });
    await Promise.all([
      playerAction(id, 'ann', { type: 'lock_in' }),
      playerAction(id, 'bo', { type: 'lock_in' }),
      pollAll(id),
    ]);
    const game = (await getGame(id, 'cy'))!;
    expect(game.moveCount).toBe(1);
    expect(game.lastMove).toBe('e2e4');
    expect(decisions(game).map((l) => l.message)).toEqual(['Engine chose bo’s e4 over ann’s f3']);
    expect(evaluate).toHaveBeenCalledTimes(2);
    expect(game.phase).toBe('team2_selection');
  });

  it('ends a turn at its deadline exactly once, however many polls arrive', async () => {
    const id = await startedGame();
    await playerAction(id, 'ann', { type: 'submit_move', move: 'g1f3' });
    advance(SELECTION_MS + 1);
    await pollAll(id, 3);
    const game = (await getGame(id, 'ann'))!;
    expect(game.moveCount).toBe(1);
    expect(decisions(game).map((l) => l.message)).toEqual(['White plays ann’s Nf3']);
  });

  it('asks the engine once when a disagreement times out and everyone polls at once', async () => {
    const id = await startedGame();
    await playerAction(id, 'ann', { type: 'submit_move', move: 'f2f3' });
    await playerAction(id, 'bo', { type: 'submit_move', move: 'e2e4' });
    advance(SELECTION_MS + 1);
    await pollAll(id, 3);
    const game = (await getGame(id, 'ann'))!;
    expect(game.moveCount).toBe(1);
    expect(decisions(game).map((l) => l.message)).toEqual(['Engine chose bo’s e4 over ann’s f3']);
    expect(evaluate).toHaveBeenCalledTimes(2);
  });

  it('refuses a move after the deadline', async () => {
    const id = await startedGame();
    advance(SELECTION_MS);
    const { error } = await playerAction(id, 'ann', { type: 'submit_move', move: 'e2e4' });
    expect(error).toMatch(/Time’s up|turn/);
  });

  it('plays the first player’s move when the engine fails', async () => {
    evaluate.mockRejectedValue(new Error('Stockfish download rejected'));
    const id = await startedGame();
    await playerAction(id, 'ann', { type: 'submit_move', move: 'd2d4' });
    await playerAction(id, 'bo', { type: 'submit_move', move: 'e2e4' });
    await playerAction(id, 'ann', { type: 'lock_in' });
    const { game } = await playerAction(id, 'bo', { type: 'lock_in' });
    expect(game!.lastMove).toBe('d2d4');
    expect(decisions(game!).at(-1)?.message).toBe('White plays ann’s d4');
  });

  it('redoes a decision that never finished', async () => {
    const id = await startedGame();
    // As if a Lambda died mid-decision 21 s ago: stuck in "computing", lock long gone.
    const key = `collaborativeCheckmate:game:${id}`;
    const [data, version] = await redis().hmget(key, 'data', 'version');
    const stuck = { ...JSON.parse(data!), phase: 'team1_computing', computingSince: now - 21_000 };
    await redis().hset(key, 'data', JSON.stringify(stuck), 'version', String(Number(version) + 1));
    const game = (await getGame(id, 'ann'))!;
    expect(game.moveCount).toBe(1);
    expect(game.phase).toBe('team2_selection');
  });

  it('records a finished game once, however many polls see the end', async () => {
    const id = await startedGame();
    const [finished, blackWins] = [await stat('games_finished'), await stat('black_wins')];
    const turns: [string, string[]][] = [
      ['f2f3', ['ann', 'bo']],
      ['e7e5', ['cy', 'di']],
      ['g2g4', ['ann', 'bo']],
      ['d8h4', ['cy', 'di']],
    ];
    for (const [move, team] of turns) {
      for (const p of team) await playerAction(id, p, { type: 'submit_move', move });
      await Promise.all([...team.map((p) => playerAction(id, p, { type: 'lock_in' })), pollAll(id)]);
    }
    await pollAll(id, 3);
    const game = (await getGame(id, 'ann'))!;
    expect(game.result).toEqual({ winner: 'black', reason: 'checkmate' });
    expect(await stat('games_finished')).toBe(finished + 1);
    expect(await stat('black_wins')).toBe(blackWins + 1);
    const last = JSON.parse((await redis().lindex('collaborativeCheckmate:finished', 0))!);
    expect(last).toMatchObject({ id, moves: 4, sameMoves: { t1: 2, t2: 2 } });
  });

  it('frees the seat of a player who stopped polling and keeps everyone else', async () => {
    const id = await startedGame();
    advance(20_000);
    await Promise.all(PLAYERS.map((p) => getGame(id, p)));
    advance(20_000);
    await Promise.all(['ann', 'bo', 'cy'].map((p) => getGame(id, p))); // di has gone quiet
    advance(12_000); // di: 32 s silent; the others: 12 s
    const game = (await getGame(id, 'ann'))!;
    expect(Object.values(game.seats).map((s) => s.player)).toEqual(['ann', 'bo', 'cy', null]);
    expect(game.log.filter((l) => l.message === 'di left').length).toBe(1);
  });

  it('records a newcomer’s presence before seating them', async () => {
    const id = await startedGame();
    advance(20_000);
    await Promise.all(['ann', 'bo', 'cy'].map((p) => getGame(id, p)));
    advance(12_000); // di is gone after this poll
    await getGame(id, 'ann');
    // eve takes di's seat while the others poll; none of those polls may drop her.
    const [view] = await Promise.all([joinGame(id, 'eve', false), getGame(id, 'bo'), getGame(id, 'cy')]);
    expect(view.yourSeat).toBe('t2p2');
    expect(Number(await redis().hget(`collaborativeCheckmate:seen:${id}`, 'eve'))).toBe(now);
    expect((await getGame(id, 'ann'))!.seats.t2p2.player).toBe('eve');
  });

  it('writes a newcomer’s presence before the save that seats them', async () => {
    // Otherwise a poll landing in between sees a seated player with no presence and frees the seat.
    const id = newId();
    const monitor = await redis().duplicate().monitor();
    const commands: string[][] = [];
    monitor.on('monitor', (_time: string, args: string[]) => commands.push(args));
    await joinGame(id, 'eve', false);
    await new Promise((r) => setTimeout(r, 50));
    monitor.disconnect();
    const presence = commands.findIndex((c) => c[0].toLowerCase() === 'hset' && c[1].endsWith(`seen:${id}`));
    const seating = commands.findIndex((c) => c[0].toLowerCase() === 'eval' && c.some((a) => a.includes('"eve"')));
    expect(presence).toBeGreaterThanOrEqual(0);
    expect(seating).toBeGreaterThan(presence);
  });

  it('lets a fifth visitor watch, but not act', async () => {
    const id = await startedGame();
    const view = await joinGame(id, 'zed', false);
    expect(view.yourSeat).toBeNull();
    expect((await playerAction(id, 'zed', { type: 'submit_move', move: 'e2e4' })).error).toMatch(/seat/);
  });

  it('lists public games with their seat count, never private ones', async () => {
    const pub = newId();
    const priv = newId();
    await joinGame(pub, 'ann', false);
    await joinGame(pub, 'bo', false);
    await joinGame(priv, 'cy', true);
    const open = await listOpenGames();
    expect(open.find((g) => g.game_id === pub)?.occupied_seats).toBe(2);
    expect(open.some((g) => g.game_id === priv)).toBe(false);
  });
});
