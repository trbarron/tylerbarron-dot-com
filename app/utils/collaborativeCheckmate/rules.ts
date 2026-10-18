// Collaborative Checkmate's rules as plain functions on a game record: no
// Redis, no clock, no engine. game.server.ts loads a record, applies these and
// saves it. Each returns the same object when nothing changed.

import { Chess } from 'chess.js';
import {
  GamePhase,
  SEAT_TIMEOUT_MS,
  SEATS,
  SELECTION_MS,
  selectionPhase,
  teamOf,
  type GamePhaseType,
  type GameResult,
  type LogEntry,
  type PlayerAction,
  type PublicGame,
  type SeatKey,
  type Team,
} from './types';

export interface SeatRecord {
  player: string | null;
  ready: boolean;
  /** UCI move for the current turn. */
  selection: string | null;
  lockedIn: boolean;
}

export interface Game {
  id: string;
  createdAt: number;
  isPrivate: boolean;
  phase: GamePhaseType;
  /** Every move since the start position, in UCI; the position is replayed from these. */
  moves: string[];
  deadline: number | null;
  computingSince: number | null;
  seats: Record<SeatKey, SeatRecord>;
  /** Turns where both teammates picked the same move. */
  sameMoves: { t1: number; t2: number };
  /** Turns the engine had to choose between two different moves. */
  judgedMoves: number;
  result: GameResult | null;
  log: LogEntry[];
}

const LOG_LIMIT = 80;
/** A computation that hasn't finished in this long is assumed lost (e.g. a Lambda timeout) and redone. */
const STUCK_COMPUTE_MS = 20_000;
const TEAM_NAME: Record<Team, string> = { 1: 'White', 2: 'Black' };

const emptySeat = (): SeatRecord => ({ player: null, ready: false, selection: null, lockedIn: false });

export function newGame(id: string, isPrivate: boolean, now: number): Game {
  return {
    id,
    createdAt: now,
    isPrivate,
    phase: GamePhase.SETUP,
    moves: [],
    deadline: null,
    computingSince: null,
    seats: { t1p1: emptySeat(), t1p2: emptySeat(), t2p1: emptySeat(), t2p2: emptySeat() },
    sameMoves: { t1: 0, t2: 0 },
    judgedMoves: 0,
    result: null,
    log: [{ at: now, type: 'system', message: `Game ${id} created` }],
  };
}

export function position(moves: string[]): Chess {
  const chess = new Chess();
  for (const uci of moves) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  return chess;
}

export function seatOf(game: Game, player: string): SeatKey | null {
  return SEATS.find((s) => game.seats[s].player === player) ?? null;
}

function activeTeam(phase: GamePhaseType): Team | null {
  if (phase === GamePhase.TEAM1_SELECTION || phase === GamePhase.TEAM1_COMPUTING) return 1;
  if (phase === GamePhase.TEAM2_SELECTION || phase === GamePhase.TEAM2_COMPUTING) return 2;
  return null;
}

function teamSeats(team: Team): SeatKey[] {
  return team === 1 ? ['t1p1', 't1p2'] : ['t2p1', 't2p2'];
}

function withLog(game: Game, now: number, type: LogEntry['type'], message: string): Game {
  return { ...game, log: [...game.log, { at: now, type, message }].slice(-LOG_LIMIT) };
}

function setSeat(game: Game, seat: SeatKey, patch: Partial<SeatRecord>): Game {
  return { ...game, seats: { ...game.seats, [seat]: { ...game.seats[seat], ...patch } } };
}

/** Seat a newcomer in the first free seat. Seated players and spectators (game full) are unchanged. */
export function join(game: Game, player: string, now: number): Game {
  if (seatOf(game, player)) return game;
  const free = SEATS.find((s) => !game.seats[s].player);
  if (!free) return game;
  return withLog(
    setSeat(game, free, { ...emptySeat(), player }),
    now,
    'system',
    `${player} joined ${TEAM_NAME[teamOf(free)]}`,
  );
}

/** Apply a player's action, or explain why it can't happen. */
export function act(game: Game, player: string, action: PlayerAction, now: number): { game: Game; error?: string } {
  const seat = seatOf(game, player);

  if (action.type === 'take_seat') {
    if (!SEATS.includes(action.seat)) return { game, error: 'No such seat.' };
    if (seat === action.seat) return { game };
    if (seat && game.seats[seat].ready) return { game, error: 'You can’t change seats after readying up.' };
    if (game.seats[action.seat].player) return { game, error: 'That seat is taken.' };
    let next = seat ? setSeat(game, seat, emptySeat()) : game;
    next = setSeat(next, action.seat, { ...emptySeat(), player });
    return { game: withLog(next, now, 'system', `${player} sat with ${TEAM_NAME[teamOf(action.seat)]}`) };
  }

  if (!seat) return { game, error: 'Take a seat first.' };

  if (action.type === 'ready' || action.type === 'not_ready') {
    const ready = action.type === 'ready';
    if (game.seats[seat].ready === ready) return { game };
    if (!ready && game.phase !== GamePhase.SETUP) return { game, error: 'The game has started.' };
    return { game: withLog(setSeat(game, seat, { ready }), now, 'system', `${player} is ${ready ? '' : 'not '}ready`) };
  }

  const team = teamOf(seat);
  if (game.phase !== selectionPhase(team)) return { game, error: 'It isn’t your team’s turn.' };
  if (game.deadline !== null && now >= game.deadline) return { game, error: 'Time’s up for this move.' };
  if (game.seats[seat].lockedIn) return { game, error: 'You’ve locked in your move.' };

  if (action.type === 'submit_move') {
    const legal = position(game.moves)
      .moves({ verbose: true })
      .find((m) => m.lan === action.move);
    if (!legal) return { game, error: 'That move isn’t legal.' };
    const first = !game.seats[seat].selection;
    const next = setSeat(game, seat, { selection: legal.lan, ready: true });
    return { game: first ? withLog(next, now, 'move', `${player} has a move in`) : next };
  }

  // lock_in
  if (!game.seats[seat].selection) return { game, error: 'Pick a move first.' };
  return { game: withLog(setSeat(game, seat, { lockedIn: true }), now, 'move', `${player} locked in`) };
}

/** Free the seats of players who stopped polling. `seen` maps player → last poll (ms). */
export function vacateStale(game: Game, seen: Record<string, number>, now: number): Game {
  let next = game;
  for (const seat of SEATS) {
    const player = next.seats[seat].player;
    if (player && now - (seen[player] ?? 0) > SEAT_TIMEOUT_MS) {
      next = withLog(setSeat(next, seat, emptySeat()), now, 'system', `${player} left`);
    }
  }
  return next;
}

/** Everyone on the team has locked in, or isn't playing (empty seat, never readied). */
export function teamReady(game: Game, team: Team): boolean {
  return teamSeats(team).every((s) => {
    const seat = game.seats[s];
    return !seat.player || !seat.ready || seat.lockedIn;
  });
}

/** What the game is waiting on the server to do, if anything. */
export function due(game: Game, now: number): 'start' | 'compute' | null {
  if (game.phase === GamePhase.SETUP) {
    return SEATS.every((s) => game.seats[s].player && game.seats[s].ready) ? 'start' : null;
  }
  const team = activeTeam(game.phase);
  if (!team) return null;
  if (game.phase === selectionPhase(team)) {
    return (game.deadline !== null && now >= game.deadline) || teamReady(game, team) ? 'compute' : null;
  }
  return game.computingSince !== null && now - game.computingSince > STUCK_COMPUTE_MS ? 'compute' : null;
}

export function start(game: Game, now: number): Game {
  return withLog(
    { ...game, phase: GamePhase.TEAM1_SELECTION, deadline: now + SELECTION_MS },
    now,
    'system',
    'Game on! White to move',
  );
}

/** Mark the active team's turn as being decided, so other requests don't start a second computation. */
export function beginCompute(game: Game, now: number): Game {
  const team = activeTeam(game.phase);
  if (!team) return game;
  return {
    ...game,
    phase: team === 1 ? GamePhase.TEAM1_COMPUTING : GamePhase.TEAM2_COMPUTING,
    computingSince: now,
  };
}

export interface MoveChoice {
  uci: string;
  how: 'unanimous' | 'engine' | 'single' | 'random';
  /** Whose move it was (empty for a random move). */
  by: string[];
  /** For an engine choice, the move it passed over and whose that was. */
  over?: { uci: string; by: string };
}

/** Score of the position after a move, from the moving team's side; higher is better. */
export type MoveJudge = (fenAfterMove: string) => Promise<number>;

/** Pick the team's move from its selections, asking the engine when teammates disagree. */
export async function chooseMove(
  game: Game,
  judge: MoveJudge,
  random: () => number = Math.random,
): Promise<MoveChoice> {
  const team = activeTeam(game.phase);
  const chess = position(game.moves);
  const legal = new Set(chess.moves({ verbose: true }).map((m) => m.lan));
  const picks = (team ? teamSeats(team) : [])
    .map((s) => game.seats[s])
    .filter((s): s is SeatRecord & { player: string; selection: string } =>
      Boolean(s.player && s.selection && legal.has(s.selection)),
    );

  if (picks.length === 2 && picks[0].selection === picks[1].selection) {
    return { uci: picks[0].selection, how: 'unanimous', by: [picks[0].player, picks[1].player] };
  }
  if (picks.length === 2) {
    const fenAfter = (uci: string) => {
      const c = new Chess(chess.fen());
      c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      return c.fen();
    };
    const [a, b] = picks;
    try {
      const [scoreA, scoreB] = [await judge(fenAfter(a.selection)), await judge(fenAfter(b.selection))];
      // Ties go to the second seat, as on the original server.
      const [win, lose] = scoreA > scoreB ? [a, b] : [b, a];
      return { uci: win.selection, how: 'engine', by: [win.player], over: { uci: lose.selection, by: lose.player } };
    } catch {
      return { uci: a.selection, how: 'single', by: [a.player] };
    }
  }
  if (picks.length === 1) return { uci: picks[0].selection, how: 'single', by: [picks[0].player] };

  const moves = [...legal];
  return { uci: moves[Math.floor(random() * moves.length)], how: 'random', by: [] };
}

function san(moves: string[], uci: string): string {
  const chess = position(moves);
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
}

/** Play the chosen move, then either end the game or hand the turn to the other team. */
export function applyMove(game: Game, choice: MoveChoice, now: number): Game {
  const team = activeTeam(game.phase);
  if (!team) return game;
  const name = TEAM_NAME[team];
  const moveSan = san(game.moves, choice.uci);
  const message =
    choice.how === 'unanimous'
      ? `${name} agreed: ${moveSan}`
      : choice.how === 'engine'
        ? `Engine chose ${choice.by[0]}’s ${moveSan} over ${choice.over!.by}’s ${san(game.moves, choice.over!.uci)}`
        : choice.how === 'single'
          ? `${name} plays ${choice.by[0]}’s ${moveSan}`
          : `No move from ${name} in time, so a random ${moveSan}`;

  const moves = [...game.moves, choice.uci];
  const key = team === 1 ? 't1' : 't2';
  let next: Game = {
    ...game,
    moves,
    computingSince: null,
    sameMoves: choice.how === 'unanimous' ? { ...game.sameMoves, [key]: game.sameMoves[key] + 1 } : game.sameMoves,
    judgedMoves: game.judgedMoves + (choice.how === 'engine' ? 1 : 0),
    seats: Object.fromEntries(
      SEATS.map((s) => [s, { ...game.seats[s], selection: null, lockedIn: false }]),
    ) as Game['seats'],
  };
  next = withLog(next, now, choice.how === 'engine' ? 'engine' : 'move', message);

  const chess = position(moves);
  const result: GameResult | null = chess.isCheckmate()
    ? { winner: team === 1 ? 'white' : 'black', reason: 'checkmate' }
    : chess.isStalemate()
      ? { winner: null, reason: 'stalemate' }
      : chess.isDraw()
        ? { winner: null, reason: 'draw' }
        : null;

  if (result) {
    const headline =
      result.reason === 'checkmate' ? `Checkmate! ${name} wins` : result.reason === 'stalemate' ? 'Stalemate' : 'Draw';
    return withLog(
      { ...next, phase: GamePhase.COOLDOWN, deadline: null, result },
      now,
      'game_over',
      `${headline}. Teammates agreed on ${next.sameMoves.t1} White and ${next.sameMoves.t2} Black moves of ${moves.length}.`,
    );
  }
  const other: Team = team === 1 ? 2 : 1;
  return { ...next, phase: selectionPhase(other), deadline: now + SELECTION_MS };
}

/** The game as `viewer` may see it: teammates' moves stay hidden until the turn is decided. */
export function publicView(game: Game, viewer: string | null, now: number): PublicGame {
  const yourSeat = viewer ? seatOf(game, viewer) : null;
  return {
    id: game.id,
    phase: game.phase,
    fen: position(game.moves).fen(),
    lastMove: game.moves.at(-1) ?? null,
    deadline: game.deadline,
    serverNow: now,
    seats: Object.fromEntries(
      SEATS.map((s) => {
        const seat = game.seats[s];
        return [
          s,
          { player: seat.player, ready: seat.ready, submitted: Boolean(seat.selection), lockedIn: seat.lockedIn },
        ];
      }),
    ) as PublicGame['seats'],
    yourSeat,
    yourSelection: yourSeat ? game.seats[yourSeat].selection : null,
    moveCount: game.moves.length,
    result: game.result,
    log: game.log,
  };
}

/** Lobby rule: public, still in setup, a seat free, and opened recently. */
export function isOpen(game: Game, now: number, maxAgeMs: number): boolean {
  return (
    !game.isPrivate &&
    game.phase === GamePhase.SETUP &&
    now - game.createdAt < maxAgeMs &&
    SEATS.some((s) => !game.seats[s].player)
  );
}
