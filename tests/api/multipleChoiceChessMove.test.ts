/**
 * POST /api/multipleChoiceChess/move: turn order, legality, scoring and game end,
 * with the Redis layer stubbed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createActionArgs } from '../setup';
import type { GameState } from '~/utils/multipleChoiceChess/gameState.server';

const store = vi.hoisted(() => ({ getGame: vi.fn(), applyMove: vi.fn() }));
vi.mock('~/utils/multipleChoiceChess/gameState.server', () => store);

import { action } from '~/routes/api/multipleChoiceChess/move';

const base: GameState = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn: 'white',
  white_id: 'w1',
  black_id: 'b1',
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
  created_at: 0,
  last_updated: 0,
  white_last_seen: 0,
  black_last_seen: 0,
};

const move = (body: Record<string, unknown>) =>
  action(
    createActionArgs('/api/multipleChoiceChess/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: 'abc123', choices: ['e2e4', 'd2d4', 'c2c4', 'g2g3'], ...body }),
    }),
  );

beforeEach(() => {
  store.getGame.mockReset().mockResolvedValue(base);
  store.applyMove.mockReset().mockResolvedValue(undefined);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/multipleChoiceChess/move', () => {
  it('scores the pick by rank and hands the turn over', async () => {
    const res = await move({ player_id: 'w1', move: 'e2e4', rank: 2 });
    expect(res.status).toBe(200);
    expect(store.applyMove).toHaveBeenCalledWith(
      'abc123',
      expect.objectContaining({
        turn: 'black',
        move: 'e2e4',
        rank: 2,
        whiteScore: 3,
        blackScore: 0,
        whiteMoves: 1,
        whiteRank2: 1,
        status: 'active',
      }),
    );
  });

  it('refuses a move out of turn, from a stranger, illegal, or in a finished game', async () => {
    expect((await move({ player_id: 'b1', move: 'e7e5', rank: 1 })).status).toBe(409);
    expect((await move({ player_id: 'zz', move: 'e2e4', rank: 1 })).status).toBe(403);
    expect((await move({ player_id: 'w1', move: 'e2e5', rank: 1 })).status).toBe(400);
    store.getGame.mockResolvedValue({ ...base, status: 'complete' });
    expect((await move({ player_id: 'w1', move: 'e2e4', rank: 1 })).status).toBe(409);
    expect(store.applyMove).not.toHaveBeenCalled();
  });

  it('400s missing fields and 404s an unknown game', async () => {
    expect((await move({ player_id: 'w1', move: 'e2e4' })).status).toBe(400);
    store.getGame.mockResolvedValue(null);
    expect((await move({ player_id: 'w1', move: 'e2e4', rank: 1 })).status).toBe(404);
  });

  it('ends the game on checkmate, won by the side that moved', async () => {
    // Fool's mate: Black plays Qh4#.
    store.getGame.mockResolvedValue({
      ...base,
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2',
      turn: 'black',
    });
    const res = await move({ player_id: 'b1', move: 'd8h4', rank: 1 });
    expect(await res.json()).toEqual({ ok: true, status: 'complete', result: 'black', result_reason: 'checkmate' });
    expect(store.applyMove).toHaveBeenCalledWith(
      'abc123',
      expect.objectContaining({ blackScore: 4, status: 'complete' }),
    );
  });
});
