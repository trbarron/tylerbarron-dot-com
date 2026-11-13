/** Authorization and race refusals for the four previously uncovered game actions. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActionArgs } from '../setup';
import type { GameState } from '~/utils/multipleChoiceChess/gameState.server';

const store = vi.hoisted(() => ({
  getGame: vi.fn(),
  getAvailableGames: vi.fn(),
  createGame: vi.fn(),
  joinGame: vi.fn(),
  resignGame: vi.fn(),
  claimWinByAbandonment: vi.fn(),
}));
const limiter = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
vi.mock('~/utils/multipleChoiceChess/gameState.server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/utils/multipleChoiceChess/gameState.server')>()),
  ...store,
}));
vi.mock('~/utils/rateLimit.server', () => limiter);

import { action as create } from '~/routes/api/multipleChoiceChess/create';
import { action as join } from '~/routes/api/multipleChoiceChess/join';
import { action as resign } from '~/routes/api/multipleChoiceChess/resign';
import { action as claimWin } from '~/routes/api/multipleChoiceChess/claimWin';

const now = new Date('2026-11-12T12:00:00Z').getTime();
const active: GameState = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn: 'white',
  white_id: 'p_white-secret',
  black_id: 'p_black-secret',
  white_score: 0,
  black_score: 0,
  white_moves: 0,
  black_moves: 0,
  white_rank_1: 0,
  white_rank_2: 0,
  white_rank_4: 0,
  white_rank_6: 0,
  black_rank_1: 0,
  black_rank_2: 0,
  black_rank_4: 0,
  black_rank_6: 0,
  status: 'active',
  result: '',
  result_reason: '',
  last_move: '',
  last_move_rank: 0,
  last_move_choices: '[]',
  created_at: now,
  last_updated: now,
  white_last_seen: now,
  black_last_seen: now,
};

type Action = typeof create;
const post = (action: Action, body: unknown) =>
  action(
    createActionArgs('/api/multipleChoiceChess/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  store.getGame.mockResolvedValue({ ...active });
  store.getAvailableGames.mockResolvedValue([]);
  limiter.checkRateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 });
});
afterEach(() => vi.useRealTimers());

describe.each([
  { name: 'resign', action: resign, write: store.resignGame },
  { name: 'claimWin', action: claimWin, write: store.claimWinByAbandonment },
])('$name authorization', ({ action, write }) => {
  it('refuses a stranger before changing the game', async () => {
    const res = await post(action, { game_id: 'abc123', player_id: 'p_stranger' });
    expect(res.status).toBe(403);
    expect(write).not.toHaveBeenCalled();
  });

  it.each([{}, { game_id: '../game', player_id: 'p_white-secret' }, { game_id: 'abc123', player_id: 42 }])(
    'rejects malformed identity %j without reading or writing a game',
    async (body) => {
      expect((await post(action, body)).status).toBe(400);
      expect(store.getGame).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    },
  );

  it('refuses a missing game', async () => {
    store.getGame.mockResolvedValue(null);
    expect((await post(action, { game_id: 'abc123', player_id: 'p_white-secret' })).status).toBe(404);
    expect(write).not.toHaveBeenCalled();
  });

  it.each(['waiting', 'complete'])('refuses an inactive %s game', async (status) => {
    store.getGame.mockResolvedValue({ ...active, status });
    expect((await post(action, { game_id: 'abc123', player_id: 'p_white-secret' })).status).toBe(409);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('resign', () => {
  it.each([
    ['p_white-secret', 'white'],
    ['p_black-secret', 'black'],
  ])('only resigns the side belonging to %s', async (playerId, color) => {
    expect((await post(resign, { game_id: ' ABC123 ', player_id: playerId })).status).toBe(200);
    expect(store.getGame).toHaveBeenCalledWith('abc123');
    expect(store.resignGame).toHaveBeenCalledExactlyOnceWith('abc123', color);
  });
});

describe('claimWin abandonment threshold', () => {
  it.each([0, now, now - 89_999, now + 1000])('refuses an opponent last seen at %s', async (lastSeen) => {
    store.getGame.mockResolvedValue({ ...active, black_last_seen: lastSeen });
    expect((await post(claimWin, { game_id: 'abc123', player_id: active.white_id })).status).toBe(409);
    expect(store.claimWinByAbandonment).not.toHaveBeenCalled();
  });

  it.each([
    { playerId: active.white_id, color: 'white', seenField: 'black_last_seen' },
    { playerId: active.black_id, color: 'black', seenField: 'white_last_seen' },
  ])('allows $color at exactly 90 seconds using the opponent’s timestamp', async ({ playerId, color, seenField }) => {
    store.getGame.mockResolvedValue({ ...active, [seenField]: now - 90_000 });
    expect((await post(claimWin, { game_id: ' ABC123 ', player_id: playerId })).status).toBe(200);
    expect(store.claimWinByAbandonment).toHaveBeenCalledExactlyOnceWith('abc123', color);
  });
});

describe('join', () => {
  it('refuses a full game without attempting to assign a seat', async () => {
    expect((await post(join, { game_id: 'abc123' })).status).toBe(409);
    expect(store.joinGame).not.toHaveBeenCalled();
  });

  it('refuses a seat lost to another joiner between reading and saving', async () => {
    store.getGame.mockResolvedValue({ ...active, status: 'waiting', black_id: '' });
    store.joinGame.mockResolvedValue(null);
    expect((await post(join, { game_id: 'abc123' })).status).toBe(409);
  });

  it('returns only the joining player’s secret and a public game state', async () => {
    store.getGame.mockResolvedValue({ ...active, status: 'waiting', black_id: '' });
    store.joinGame.mockImplementation(async (_gameId, playerId) => ({ ...active, black_id: playerId }));
    const res = await post(join, { game_id: ' ABC123 ' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ game_id: 'abc123', color: 'black', state: { you: 'black' } });
    expect(body.player_id).toMatch(/^p_[0-9a-f-]{36}$/);
    expect(body.state).not.toHaveProperty('white_id');
    expect(body.state).not.toHaveProperty('black_id');
    expect(JSON.stringify(body)).not.toContain(active.white_id);
    expect(store.joinGame).toHaveBeenCalledExactlyOnceWith('abc123', body.player_id);
  });

  it('reports an empty quick-match queue without changing any game', async () => {
    expect((await post(join, {})).status).toBe(404);
    expect(store.getGame).not.toHaveBeenCalled();
    expect(store.joinGame).not.toHaveBeenCalled();
  });
});

describe('create', () => {
  it('enforces the address quota before allocating a game', async () => {
    limiter.checkRateLimit.mockResolvedValue({ allowed: false, retryAfter: 120 });
    const res = await post(create, {});
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('120');
    expect(store.getGame).not.toHaveBeenCalled();
    expect(store.createGame).not.toHaveBeenCalled();
    expect(limiter.checkRateLimit).toHaveBeenCalledWith(expect.any(Request), 'multipleChoiceChess', 'create', {
      max: 20,
      windowSeconds: 3600,
    });
  });

  it('returns only the creator’s secret and a public game state', async () => {
    store.getGame.mockResolvedValue(null);
    store.createGame.mockImplementation(async (_gameId, playerId) => ({ ...active, white_id: playerId, black_id: '' }));
    const res = await post(create, {});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ color: 'white', state: { you: 'white' } });
    expect(body.game_id).toMatch(/^[a-z0-9]{6}$/);
    expect(body.player_id).toMatch(/^p_[0-9a-f-]{36}$/);
    expect(body.state).not.toHaveProperty('white_id');
    expect(body.state).not.toHaveProperty('black_id');
    expect(store.createGame).toHaveBeenCalledExactlyOnceWith(body.game_id, body.player_id);
  });
});

it.each([
  { name: 'create', action: create },
  { name: 'join', action: join },
  { name: 'resign', action: resign },
  { name: 'claimWin', action: claimWin },
])('$name refuses non-POST methods before reading or writing games', async ({ action }) => {
  const res = await action(createActionArgs('/api/multipleChoiceChess/action', { method: 'GET' }));
  expect(res.status).toBe(405);
  for (const fn of Object.values(store)) expect(fn).not.toHaveBeenCalled();
  expect(limiter.checkRateLimit).not.toHaveBeenCalled();
});
