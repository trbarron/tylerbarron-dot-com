/**
 * GET /api/multipleChoiceChess/state must never hand out a player's id: the id
 * is the only thing move, resign and claimWin check.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createLoaderArgs } from '../setup';

const redis = vi.hoisted(() => ({ hgetall: vi.fn(), hset: vi.fn() }));
vi.mock('~/utils/redis.server', () => ({ getRedisClient: () => redis }));

import { loader } from '~/routes/api/multipleChoiceChess/state';
import { generatePlayerId, normalizeGameId } from '~/utils/multipleChoiceChess/gameState.server';

const stored = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn: 'white',
  white_id: 'p_white-secret',
  black_id: 'p_black-secret',
  white_score: '0',
  black_score: '0',
  white_moves: '0',
  black_moves: '0',
  status: 'active',
  result: '',
  result_reason: '',
  last_move: '',
  last_move_rank: '0',
  last_move_choices: '[]',
  created_at: '1',
  last_updated: '1',
  white_last_seen: String(Date.now()),
  black_last_seen: String(Date.now()),
};

const state = (query: string) => loader(createLoaderArgs(`/api/multipleChoiceChess/state?${query}`));

beforeEach(() => {
  redis.hgetall.mockReset().mockResolvedValue(stored);
  redis.hset.mockReset().mockResolvedValue(1);
});

describe('GET /api/multipleChoiceChess/state', () => {
  it("never returns either player's id, to a stranger or to a player", async () => {
    for (const query of ['gameId=abc123', 'gameId=abc123&playerId=p_white-secret']) {
      const text = await (await state(query)).text();
      expect(text).not.toContain('secret');
      expect(JSON.parse(text)).not.toHaveProperty('white_id');
      expect(JSON.parse(text)).not.toHaveProperty('black_id');
    }
  });

  it('tells a player which side they are, and a stranger nothing', async () => {
    expect((await (await state('gameId=abc123&playerId=p_white-secret')).json()).you).toBe('white');
    expect((await (await state('gameId=abc123&playerId=p_black-secret')).json()).you).toBe('black');
    expect((await (await state('gameId=abc123&playerId=nope')).json()).you).toBeNull();
    expect((await (await state('gameId=abc123')).json()).you).toBeNull();
  });

  it('rejects a malformed game code', async () => {
    expect((await state('gameId=../etc')).status).toBe(400);
  });
});

describe('ids', () => {
  it('player ids are not guessable from the clock', () => {
    const a = generatePlayerId();
    expect(a).toMatch(/^p_[0-9a-f-]{36}$/);
    expect(generatePlayerId()).not.toBe(a);
  });

  it('game codes are normalised once', () => {
    expect(normalizeGameId(' ABC123 ')).toBe('abc123');
    expect(normalizeGameId('a b')).toBeNull();
    expect(normalizeGameId(42)).toBeNull();
  });
});
