// Shapes produced by the camel-up-tournament Lambda (Camel_Up_Cup_2K18 repo,
// lambda/handler.py) and published to the CDN bucket as JSON.

export interface LeaderboardBot {
  name: string;
  author: string | null;
  /** LLM used to generate the bot, if any (house bots only). */
  model?: string | null;
  /** Free-text provenance, e.g. "Hand-coded; won the original Cup". */
  note?: string | null;
  year?: number | null;
  builtin: boolean;
  wins: number;
  games: number;
  winPct: number;
  avgCoins: number;
  avgMoveMs: number;
  maxMoveMs: number;
  actions: Record<string, number>;
}

export interface Leaderboard {
  updated: string;
  totalGames: number;
  lastSubmission?: { id: string; botName: string; author: string | null };
  bots: LeaderboardBot[];
}

export type SubmissionPhase =
  | "queued"
  | "validating"
  | "running"
  | "complete"
  | "rejected"
  | "error";

export interface SubmissionStatus {
  id: string;
  phase: SubmissionPhase;
  botName: string | null;
  gamesDone: number;
  totalGames: number;
  updated: string;
  rank?: number | null;
  reason?: string;
}
