/**
 * Collaborative Checkmate's rules, without Redis or the engine.
 */

import { describe, it, expect } from 'vitest';
import {
  act,
  applyMove,
  beginCompute,
  chooseMove,
  due,
  isOpen,
  join,
  newGame,
  publicView,
  start,
  teamReady,
  vacateStale,
  type Game,
} from '~/utils/collaborativeCheckmate/rules';
import { GamePhase, SEAT_TIMEOUT_MS, SELECTION_MS } from '~/utils/collaborativeCheckmate/types';

const T = 1_000_000;

/** Four players seated in order (t1p1, t1p2, t2p1, t2p2), all ready, game started. */
function startedGame(): Game {
  let g = newGame('g1', false, T);
  for (const p of ['ann', 'bo', 'cy', 'di']) g = join(g, p, T);
  for (const p of ['ann', 'bo', 'cy', 'di']) g = act(g, p, { type: 'ready' }, T).game;
  return start(g, T);
}

function submit(g: Game, player: string, move: string, now = T + 1000): Game {
  const r = act(g, player, { type: 'submit_move', move }, now);
  expect(r.error).toBeUndefined();
  return r.game;
}

describe('seats', () => {
  it('seats newcomers in order and lets a fifth player watch', () => {
    let g = newGame('g1', false, T);
    for (const p of ['ann', 'bo', 'cy', 'di', 'ed']) g = join(g, p, T);
    expect([g.seats.t1p1.player, g.seats.t1p2.player, g.seats.t2p1.player, g.seats.t2p2.player]).toEqual([
      'ann',
      'bo',
      'cy',
      'di',
    ]);
    expect(join(g, 'ann', T)).toBe(g);
  });

  it('moves a player to a free seat, but not a taken one or after readying', () => {
    let g = join(join(newGame('g1', false, T), 'ann', T), 'bo', T);
    g = act(g, 'ann', { type: 'take_seat', seat: 't2p2' }, T).game;
    expect(g.seats.t1p1.player).toBeNull();
    expect(g.seats.t2p2.player).toBe('ann');
    expect(act(g, 'bo', { type: 'take_seat', seat: 't2p2' }, T).error).toMatch(/taken/);
    g = act(g, 'ann', { type: 'ready' }, T).game;
    expect(act(g, 'ann', { type: 'take_seat', seat: 't1p1' }, T).error).toMatch(/readying/);
  });

  it('starts once all four are seated and ready, and then can’t be un-readied', () => {
    let g = newGame('g1', false, T);
    for (const p of ['ann', 'bo', 'cy', 'di']) g = join(g, p, T);
    for (const p of ['ann', 'bo', 'cy']) g = act(g, p, { type: 'ready' }, T).game;
    expect(due(g, T)).toBeNull();
    g = act(g, 'di', { type: 'ready' }, T).game;
    expect(due(g, T)).toBe('start');
    g = start(g, T);
    expect(g.phase).toBe(GamePhase.TEAM1_SELECTION);
    expect(g.deadline).toBe(T + SELECTION_MS);
    expect(act(g, 'ann', { type: 'not_ready' }, T).error).toMatch(/started/);
  });

  it('frees the seat of a player who stopped polling', () => {
    const g = startedGame();
    const now = T + SEAT_TIMEOUT_MS + 1;
    const seen = { ann: now - 1000, bo: T, cy: now, di: now };
    const after = vacateStale(g, seen, now);
    expect(after.seats.t1p1.player).toBe('ann');
    expect(after.seats.t1p2.player).toBeNull();
    expect(after.log.at(-1)?.message).toBe('bo left');
    expect(vacateStale(g, { ann: now, bo: now, cy: now, di: now }, now)).toBe(g);
  });
});

describe('choosing moves', () => {
  it('takes only legal moves, from the team whose turn it is, before the deadline', () => {
    const g = startedGame();
    expect(act(g, 'cy', { type: 'submit_move', move: 'e7e5' }, T).error).toMatch(/turn/);
    expect(act(g, 'ann', { type: 'submit_move', move: 'e2e5' }, T).error).toMatch(/legal/);
    expect(act(g, 'ann', { type: 'submit_move', move: 'e2e4' }, T + SELECTION_MS).error).toMatch(/Time/);
    const after = submit(g, 'ann', 'e2e4');
    expect(after.seats.t1p1.selection).toBe('e2e4');
    // Changing your mind doesn't log again.
    expect(submit(after, 'ann', 'd2d4').log.length).toBe(after.log.length);
  });

  it('needs a move before locking in, and ends the turn early once the team has locked in', () => {
    let g = startedGame();
    expect(act(g, 'ann', { type: 'lock_in' }, T).error).toMatch(/Pick/);
    g = act(submit(g, 'ann', 'e2e4'), 'ann', { type: 'lock_in' }, T).game;
    expect(teamReady(g, 1)).toBe(false);
    expect(due(g, T + 1000)).toBeNull();
    g = act(submit(g, 'bo', 'd2d4'), 'bo', { type: 'lock_in' }, T).game;
    expect(due(g, T + 1000)).toBe('compute');
  });

  it('counts an empty seat as locked in, and ends the turn at the deadline regardless', () => {
    let g = startedGame();
    g = { ...g, seats: { ...g.seats, t1p2: { player: null, ready: false, selection: null, lockedIn: false } } };
    g = act(submit(g, 'ann', 'e2e4'), 'ann', { type: 'lock_in' }, T).game;
    expect(due(g, T + 1000)).toBe('compute');
    expect(due(startedGame(), T + SELECTION_MS)).toBe('compute');
  });

  it('plays an agreed move without asking the engine', async () => {
    const g = submit(submit(startedGame(), 'ann', 'e2e4'), 'bo', 'e2e4');
    const choice = await chooseMove(g, () => Promise.reject(new Error('not called')));
    expect(choice).toEqual({ uci: 'e2e4', how: 'unanimous', by: ['ann', 'bo'] });
  });

  it('asks the engine when teammates disagree, and plays the stronger move', async () => {
    const g = submit(submit(startedGame(), 'ann', 'f2f3'), 'bo', 'e2e4');
    // The fake judge likes e4 (pawn on e4 in the FEN) and dislikes f3.
    const judge = async (fen: string) => (fen.includes('4P3') ? 30 : -50);
    const choice = await chooseMove(g, judge);
    expect(choice).toEqual({ uci: 'e2e4', how: 'engine', by: ['bo'], over: { uci: 'f2f3', by: 'ann' } });
  });

  it('gives a tie to the second seat and falls back to the first if the engine fails', async () => {
    const g = submit(submit(startedGame(), 'ann', 'd2d4'), 'bo', 'e2e4');
    expect((await chooseMove(g, async () => 0)).by).toEqual(['bo']);
    expect(await chooseMove(g, () => Promise.reject(new Error('timeout')))).toEqual({
      uci: 'd2d4',
      how: 'single',
      by: ['ann'],
    });
  });

  it('plays the only move in, or a random legal one if nobody chose', async () => {
    const one = submit(startedGame(), 'bo', 'g1f3');
    expect(await chooseMove(one, async () => 0)).toEqual({ uci: 'g1f3', how: 'single', by: ['bo'] });
    const none = await chooseMove(
      startedGame(),
      async () => 0,
      () => 0,
    );
    expect(none.how).toBe('random');
    expect(none.by).toEqual([]);
  });
});

describe('playing a move', () => {
  it('hands the turn to the other team with a fresh clock and clears selections', async () => {
    const g = beginCompute(submit(submit(startedGame(), 'ann', 'e2e4'), 'bo', 'e2e4'), T + 2000);
    expect(g.phase).toBe(GamePhase.TEAM1_COMPUTING);
    const after = applyMove(g, await chooseMove(g, async () => 0), T + 3000);
    expect(after.moves).toEqual(['e2e4']);
    expect(after.phase).toBe(GamePhase.TEAM2_SELECTION);
    expect(after.deadline).toBe(T + 3000 + SELECTION_MS);
    expect(after.sameMoves).toEqual({ t1: 1, t2: 0 });
    expect(after.seats.t1p1.selection).toBeNull();
    expect(after.log.at(-1)?.message).toBe('White agreed: e4');
  });

  it('names both moves when the engine chose', () => {
    const g = beginCompute(startedGame(), T);
    const after = applyMove(g, { uci: 'e2e4', how: 'engine', by: ['bo'], over: { uci: 'f2f3', by: 'ann' } }, T);
    expect(after.log.at(-1)).toMatchObject({ type: 'engine', message: 'Engine chose bo’s e4 over ann’s f3' });
    expect(after.judgedMoves).toBe(1);
  });

  it('ends the game on checkmate with the winner', () => {
    let g = startedGame();
    // Fool's mate: 1. f3 e5 2. g4 Qh4#
    for (const uci of ['f2f3', 'e7e5', 'g2g4']) g = applyMove(beginCompute(g, T), { uci, how: 'single', by: ['x'] }, T);
    g = applyMove(beginCompute(g, T), { uci: 'd8h4', how: 'unanimous', by: ['cy', 'di'] }, T);
    expect(g.phase).toBe(GamePhase.COOLDOWN);
    expect(g.result).toEqual({ winner: 'black', reason: 'checkmate' });
    expect(g.deadline).toBeNull();
    expect(g.log.at(-1)?.message).toMatch(/^Checkmate! Black wins/);
    expect(due(g, T + 60_000)).toBeNull();
  });

  it('redoes a computation that never finished', () => {
    const g = beginCompute(startedGame(), T);
    expect(due(g, T + 5000)).toBeNull();
    expect(due(g, T + 21_000)).toBe('compute');
  });
});

describe('what players see', () => {
  it('shows your own move but only that a teammate has one', () => {
    const g = submit(submit(startedGame(), 'ann', 'e2e4'), 'bo', 'd2d4');
    const view = publicView(g, 'ann', T);
    expect(view.yourSeat).toBe('t1p1');
    expect(view.yourSelection).toBe('e2e4');
    expect(view.seats.t1p2).toEqual({ player: 'bo', ready: true, submitted: true, lockedIn: false });
    expect(JSON.stringify(view)).not.toContain('d2d4');
    expect(publicView(g, 'cy', T).yourSelection).toBeNull();
  });

  it('lists only public games in setup with a free seat, for 20 minutes', () => {
    const g = join(newGame('g1', false, T), 'ann', T);
    expect(isOpen(g, T, 20 * 60_000)).toBe(true);
    expect(isOpen(newGame('g2', true, T), T, 20 * 60_000)).toBe(false);
    expect(isOpen(g, T + 20 * 60_000, 20 * 60_000)).toBe(false);
    expect(isOpen(startedGame(), T, 20 * 60_000)).toBe(false);
  });
});
