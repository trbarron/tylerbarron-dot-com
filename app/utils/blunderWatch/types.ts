// Types for Blunder Watch

export type GamePhase = 'pregame' | 'playing' | 'finished';

export interface BlunderWatchGame {
  gameNumber: number;
  date: string;           // YYYY-MM-DD
  whiteElo: number;
  blackElo: number;
  moves: string[];        // SAN notation, 0-indexed
  blunderCount: number;
  blunderIndices: number[]; // 0-based ply indices; included for live feedback, re-validated server-side
  evals: number[];          // centipawns after each move, White-positive
  pacing: number[];         // ms to display each move before advancing (pre-computed server-side)
  lichessUrl?: string;      // URL to the original Lichess game for post-game analysis
}

export interface Flag {
  moveIndex: number;
  reactionTimeMs: number;
}

export type BlunderOutcome = 'caught_fast' | 'caught_medium' | 'caught_slow' | 'missed';

export interface BlunderResult {
  moveIndex: number;
  evalBefore: number;
  evalAfter: number;
  outcome: BlunderOutcome;
  points: number;
  reactionTimeMs?: number;
}

export interface ScoreResult {
  totalScore: number;
  blundersCaught: number;
  blundersMissed: number;
  falsePositives: number;
  blunderResults: BlunderResult[];
  resultEmoji: string;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  blundersCaught: number;
  falsePositives: number;
  timestamp: number;
}

export interface SubmitBody {
  username: string;
  date: string;
  flags: Flag[];
}

export interface SubmitResponse extends ScoreResult {
  rank: number | null;
  totalPlayers: number;
}
