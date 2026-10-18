/**
 * Collaborative Checkmate's API routes and input validation, with the game layer stubbed.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createActionArgs, createLoaderArgs } from '../setup';
import { parseAction, parseGameId, parsePlayerId } from '~/utils/collaborativeCheckmate/validate';

const game = vi.hoisted(() => ({
  getGame: vi.fn(),
  joinGame: vi.fn(),
  playerAction: vi.fn(),
  listOpenGames: vi.fn(),
}));
vi.mock('~/utils/collaborativeCheckmate/game.server', () => game);

import { loader as stateLoader } from '~/routes/api/collaborativeCheckmate/state';
import { action as joinAction } from '~/routes/api/collaborativeCheckmate/join';
import { action as playerActionRoute } from '~/routes/api/collaborativeCheckmate/action';
import { loader as availableLoader } from '~/routes/api/collaborativeCheckmate/available';

const post = (path: string, body: unknown) =>
  createActionArgs(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  Object.values(game).forEach((fn) => fn.mockReset());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('validation', () => {
  it('normalizes game codes and rejects anything else', () => {
    expect(parseGameId('  Friday-Night_2 ')).toBe('friday-night_2');
    for (const bad of ['', 'has space', 'a/b', 'x'.repeat(33), 'émile', 42, null]) expect(parseGameId(bad)).toBeNull();
  });

  it('keeps usernames’ case but limits their characters and length', () => {
    expect(parsePlayerId(' Tyler.B ')).toBe('Tyler.B');
    for (const bad of ['', 'two words', 'x'.repeat(25), '<script>', undefined]) expect(parsePlayerId(bad)).toBeNull();
  });

  it('accepts only the five actions, each in its own shape', () => {
    expect(parseAction({ type: 'take_seat', seat: 't2p1' })).toEqual({ type: 'take_seat', seat: 't2p1' });
    expect(parseAction({ type: 'ready', extra: 1 })).toEqual({ type: 'ready' });
    expect(parseAction({ type: 'submit_move', move: 'e7e8q' })).toEqual({ type: 'submit_move', move: 'e7e8q' });
    for (const bad of [
      null,
      'ready',
      { type: 'take_seat', seat: 't3p1' },
      { type: 'submit_move', move: 'e2e9' },
      { type: 'submit_move', move: 'e7e8k' },
      { type: 'submit_move', move: 'Nf3' },
      { type: 'resign' },
    ]) {
      expect(parseAction(bad)).toBeNull();
    }
  });
});

describe('GET /api/collaborativeCheckmate/state', () => {
  it('400s a bad code and 404s a missing game', async () => {
    expect((await stateLoader(createLoaderArgs('/api/collaborativeCheckmate/state?gameId=bad code'))).status).toBe(400);
    game.getGame.mockResolvedValue(null);
    expect((await stateLoader(createLoaderArgs('/api/collaborativeCheckmate/state?gameId=g1'))).status).toBe(404);
  });

  it('returns the game uncached, for the player if the name is valid', async () => {
    game.getGame.mockResolvedValue({ id: 'g1' });
    const res = await stateLoader(createLoaderArgs('/api/collaborativeCheckmate/state?gameId=G1&playerId=ann'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(game.getGame).toHaveBeenCalledWith('g1', 'ann');
    await stateLoader(createLoaderArgs('/api/collaborativeCheckmate/state?gameId=g1&playerId=bad name'));
    expect(game.getGame).toHaveBeenLastCalledWith('g1', null);
  });

  it('500s when Redis fails', async () => {
    game.getGame.mockRejectedValue(new Error('down'));
    expect((await stateLoader(createLoaderArgs('/api/collaborativeCheckmate/state?gameId=g1'))).status).toBe(500);
  });
});

describe('POST /api/collaborativeCheckmate/join', () => {
  it('405s other methods and 400s bad input', async () => {
    expect((await joinAction(createActionArgs('/api/collaborativeCheckmate/join', { method: 'GET' }))).status).toBe(
      405,
    );
    expect((await joinAction(post('/api/collaborativeCheckmate/join', { gameId: 'g1' }))).status).toBe(400);
    const notJson = createActionArgs('/api/collaborativeCheckmate/join', { method: 'POST', body: '{' });
    expect((await joinAction(notJson)).status).toBe(400);
    expect(game.joinGame).not.toHaveBeenCalled();
  });

  it('makes a game private only when asked with true', async () => {
    game.joinGame.mockResolvedValue({ id: 'g1' });
    await joinAction(post('/api/collaborativeCheckmate/join', { gameId: 'g1', playerId: 'ann', isPrivate: true }));
    expect(game.joinGame).toHaveBeenLastCalledWith('g1', 'ann', true);
    await joinAction(post('/api/collaborativeCheckmate/join', { gameId: 'g1', playerId: 'ann', isPrivate: 'yes' }));
    expect(game.joinGame).toHaveBeenLastCalledWith('g1', 'ann', false);
  });
});

describe('POST /api/collaborativeCheckmate/action', () => {
  it('400s a malformed action before touching the game', async () => {
    const res = await playerActionRoute(
      post('/api/collaborativeCheckmate/action', { gameId: 'g1', playerId: 'ann', action: { type: 'resign' } }),
    );
    expect(res.status).toBe(400);
    expect(game.playerAction).not.toHaveBeenCalled();
  });

  it('passes a refusal back with the state, and 404s a missing game', async () => {
    game.playerAction.mockResolvedValue({ game: { id: 'g1' }, error: 'It isn’t your team’s turn.' });
    const res = await playerActionRoute(
      post('/api/collaborativeCheckmate/action', { gameId: 'g1', playerId: 'ann', action: { type: 'lock_in' } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ game: { id: 'g1' }, error: 'It isn’t your team’s turn.' });
    game.playerAction.mockResolvedValue({ game: null, error: 'Game not found.' });
    const missing = await playerActionRoute(
      post('/api/collaborativeCheckmate/action', { gameId: 'g1', playerId: 'ann', action: { type: 'ready' } }),
    );
    expect(missing.status).toBe(404);
  });
});

describe('GET /api/collaborativeCheckmate/available', () => {
  it('lists open games, and 500s when Redis fails', async () => {
    game.listOpenGames.mockResolvedValue([{ game_id: 'g1', created_time: 1, occupied_seats: 2 }]);
    expect(await (await availableLoader()).json()).toEqual({
      games: [{ game_id: 'g1', created_time: 1, occupied_seats: 2 }],
    });
    game.listOpenGames.mockRejectedValue(new Error('down'));
    expect((await availableLoader()).status).toBe(500);
  });
});
