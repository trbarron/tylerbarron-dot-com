// TypeScript types for Chesser Guesser Daily Mode

export type GameMode = 'endless' | 'daily';

export interface ChessPuzzle {
  fen: string;
  eval: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
}

export interface DailyPuzzleSet {
  date: string; // YYYY-MM-DD format
  puzzles: ChessPuzzle[];
  seed: number;
}

export interface PuzzleAttempt {
  puzzleIndex: number; // 0-3
  guess: number; // User's evaluation guess in centipawns
  actualEval: number; // Actual evaluation in centipawns
  score: number; // 0-100 points
  timestamp: number;
}

export interface DailyGameState {
  username: string;
  date: string; // YYYY-MM-DD
  attempts: PuzzleAttempt[];
  totalScore: number; // 0-400 points
  completed: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  username: string;
  score: number;
  completedPuzzles: number;
  timestamp: number;
}

export interface UserStats {
  username: string;
  date: string;
  totalScore: number;
  puzzlesCompleted: number;
  bestPuzzleScore: number;
  averageAccuracy: number; // Average difference from actual eval
}

export interface EndlessModePrompt {
  show: boolean; // Deprecated, use hasShown for logic
  hasShown?: boolean;
  gamesPlayed: number;
  threshold: number; // Show prompt after this many games
}
