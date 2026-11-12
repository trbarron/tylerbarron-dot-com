// The leaderboard is produced by the tournament runner (Camel_Up_Cup_2K18 repo)
// and published to the CDN bucket as JSON.

export interface LeaderboardBot {
  name: string;
  author: string | null;
  /** LLM used to generate the bot, if any (house bots only). */
  model?: string | null;
  /** Free-text provenance, e.g. "Hand-coded; won the original Cup". */
  note?: string | null;
  year?: number | null;
  builtin: boolean;
  /** ISO-8601 UTC submission time; null/absent for house bots and pre-rollout boards. */
  submitted?: string | null;
  elo?: number | null;
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

/** A bot waiting for Tyler to run a tournament (Redis hash `camelup:pending`). */
export interface PendingSubmission {
  id: string;
  botName: string;
  author: string;
  code: string;
  /** ISO-8601 UTC. */
  submitted: string;
}
