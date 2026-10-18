// Shared by the Collaborative Checkmate server and client. Rules: docs/collaborative-checkmate.md.

export const GamePhase = {
  SETUP: 'setup',
  TEAM1_SELECTION: 'team1_selection',
  TEAM1_COMPUTING: 'team1_computing',
  TEAM2_SELECTION: 'team2_selection',
  TEAM2_COMPUTING: 'team2_computing',
  COOLDOWN: 'cooldown',
} as const;

export type GamePhaseType = (typeof GamePhase)[keyof typeof GamePhase];

export const SEATS = ['t1p1', 't1p2', 't2p1', 't2p2'] as const;
export type SeatKey = (typeof SEATS)[number];
export type Team = 1 | 2;

/** How long a team has to choose its move. */
export const SELECTION_MS = 15_000;
/** How often the game page asks for the state. */
export const POLL_MS = 500;
/** A seated player who hasn't polled for this long gives up their seat. */
export const SEAT_TIMEOUT_MS = 30_000;

export const GAME_ID_RE = /^[a-z0-9_-]{1,32}$/;
export const PLAYER_ID_RE = /^[A-Za-z0-9_.-]{1,24}$/;

export interface LogEntry {
  at: number;
  type: 'system' | 'move' | 'engine' | 'game_over';
  message: string;
}

export interface PublicSeat {
  player: string | null;
  ready: boolean;
  /** Has a move in for the current turn. Teammates see that, never which move. */
  submitted: boolean;
  lockedIn: boolean;
}

export interface GameResult {
  winner: 'white' | 'black' | null;
  reason: 'checkmate' | 'stalemate' | 'draw';
}

/** What the state endpoint returns: everything a player may see. */
export interface PublicGame {
  id: string;
  phase: GamePhaseType;
  fen: string;
  lastMove: string | null;
  /** Server clock (ms) when the current selection ends; compare with serverNow, not the local clock. */
  deadline: number | null;
  serverNow: number;
  seats: Record<SeatKey, PublicSeat>;
  yourSeat: SeatKey | null;
  /** Your own pending move for this turn (UCI). */
  yourSelection: string | null;
  moveCount: number;
  result: GameResult | null;
  log: LogEntry[];
}

export type PlayerAction =
  | { type: 'take_seat'; seat: SeatKey }
  | { type: 'ready' }
  | { type: 'not_ready' }
  | { type: 'submit_move'; move: string }
  | { type: 'lock_in' };

export function teamOf(seat: SeatKey): Team {
  return seat.startsWith('t1') ? 1 : 2;
}

export function selectionPhase(team: Team): GamePhaseType {
  return team === 1 ? GamePhase.TEAM1_SELECTION : GamePhase.TEAM2_SELECTION;
}
