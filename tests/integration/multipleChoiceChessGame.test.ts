/**
 * Multiple Choice Chess's Redis layer against a real Redis: joining and moving
 * are Lua scripts, which the stubbed Redis in tests/api can't run.
 *
 *   TEST_REDIS_URL=redis://localhost:6379 npx vitest run tests/integration/multipleChoiceChessGame.test.ts
 *
 * Skipped without TEST_REDIS_URL, and refuses anything but a local Redis.
 */

import Redis from 'ioredis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  applyMove,
  createGame,
  generateGameId,
  getGame,
  INITIAL_FEN,
  joinGame,
  resignGame,
  type MoveUpdate,
} from '~/utils/multipleChoiceChess/gameState.server';

const url = process.env.TEST_REDIS_URL;
const isLocal = Boolean(url && /^redis:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/\d+)?$/.test(url));
if (url && !isLocal) throw new Error(`TEST_REDIS_URL must be a local Redis, got ${url}`);

const { redisRef } = vi.hoisted(() => ({ redisRef: { client: null as Redis | null } }));
vi.mock('~/utils/redis.server', () => ({ getRedisClient: () => redisRef.client }));

const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const e4: MoveUpdate = {
  fen: AFTER_E4,
  turn: 'black',
  move: 'e2e4',
  rank: 1,
  choices: ['e2e4', 'd2d4', 'c2c4', 'g1f3'],
  whiteScore: 4,
  blackScore: 0,
  whiteMoves: 1,
  blackMoves: 0,
  whiteRank1: 1,
  whiteRank2: 0,
  whiteRank4: 0,
  whiteRank6: 0,
  blackRank1: 0,
  blackRank2: 0,
  blackRank4: 0,
  blackRank6: 0,
  status: 'active',
  result: '',
  resultReason: '',
};

describe.skipIf(!isLocal)('multipleChoiceChess gameState.server (real Redis)', () => {
  beforeAll(() => {
    redisRef.client = new Redis(url!, { maxRetriesPerRequest: 2 });
  });
  afterAll(async () => {
    await redisRef.client?.quit();
  });

  it('gives the black seat to exactly one of several simultaneous joiners', async () => {
    const id = generateGameId();
    await createGame(id, 'p_white');
    const joined = await Promise.all(['a', 'b', 'c', 'd', 'e'].map((p) => joinGame(id, `p_${p}`)));
    const winners = joined.filter(Boolean);
    expect(winners).toHaveLength(1);
    const game = await getGame(id);
    expect(game?.status).toBe('active');
    expect(game?.black_id).toBe(winners[0]!.black_id);
    expect(game?.white_id).toBe('p_white');
  });

  it('applies a move sent twice only once', async () => {
    const id = generateGameId();
    await createGame(id, 'p_white');
    await joinGame(id, 'p_black');
    const saved = await Promise.all([applyMove(id, INITIAL_FEN, e4), applyMove(id, INITIAL_FEN, e4)]);
    expect(saved.filter(Boolean)).toHaveLength(1);
    const game = await getGame(id);
    expect(game).toMatchObject({ fen: AFTER_E4, turn: 'black', white_score: 4, white_moves: 1, last_move: 'e2e4' });
    expect(JSON.parse(game!.last_move_choices)).toEqual(e4.choices);
  });

  it('does not apply a move to a game that has ended', async () => {
    const id = generateGameId();
    await createGame(id, 'p_white');
    await joinGame(id, 'p_black');
    await resignGame(id, 'black');
    expect(await applyMove(id, INITIAL_FEN, e4)).toBe(false);
    expect((await getGame(id))?.fen).toBe(INITIAL_FEN);
  });
});
