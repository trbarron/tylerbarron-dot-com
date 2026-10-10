// Shared types for Maia Drills. See docs/maia-drills.md for the design.

export type GameSource = 'lichess' | 'chesscom';

export type Speed = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'correspondence' | 'unknown';

/** One of the user's games, normalized across sources. */
export interface SourceGame {
  id: string;
  url?: string;
  white: string;
  black: string;
  whiteElo: number | null;
  blackElo: number | null;
  userColor: 'w' | 'b';
  speed: Speed;
  /** ms since epoch, when known. */
  playedAt?: number;
  /** Set only for games that did not start from the standard position. */
  startFen?: string;
  san: string[];
}

export interface AnalysisSettings {
  /** Rating points added to the user's rating to get Maia's rating. */
  delta: number;
  /** Minimum centipawn gap between Maia's move and the user's to count as an error. */
  thresholdCp: number;
  /** Stockfish search depth. */
  depth: number;
  /** User moves before this move number are skipped. */
  skipMoves: number;
}

export interface CardMove {
  uci: string;
  san: string;
}

export interface DrillCard {
  /** `${gameId}-${ply}` — unique within a deck. */
  id: string;
  /** Position before the user's move; the user is to move. */
  fen: string;
  ply: number;
  color: 'w' | 'b';
  played: CardMove;
  target: CardMove & { prob: number };
  /** Stockfish scores from the mover's side, clamped to ±1000. */
  evalPlayed: number;
  evalTarget: number;
  userElo: number;
  targetElo: number;
  oppElo: number;
  opponent: string;
  gameUrl?: string;
  playedAt?: number;
  speed: Speed;
}

export interface DeckStats {
  games: number;
  positions: number;
  disagreements: number;
}

export interface Deck {
  v: 1;
  source: GameSource;
  /** Player name the games were pulled for, lower-cased. */
  username: string;
  settings: AnalysisSettings;
  stats: DeckStats;
  cards: DrillCard[];
  createdAt: string;
  /** Last time new games were added. */
  updatedAt?: string;
  favorite?: boolean;
  /** Bullet was left out when fetching; adding games later does the same. */
  excludeBullet?: boolean;
  /**
   * When the newest analyzed game was played (ms since epoch). Adding games
   * fetches only games after this.
   */
  newestGameAt?: number;
}

/** What the favorites listing returns: a deck without its cards. */
export interface DeckSummary {
  id: string;
  username: string;
  source: GameSource;
  settings: AnalysisSettings;
  stats: DeckStats;
  cardCount: number;
  createdAt: string;
}

export const DEFAULT_SETTINGS: AnalysisSettings = {
  delta: 200,
  thresholdCp: 150,
  depth: 12,
  skipMoves: 0,
};

/** Bounds shared by the form and the server-side validation. */
export const LIMITS = {
  delta: { min: 0, max: 1000 },
  thresholdCp: { min: 25, max: 1000 },
  depth: { min: 6, max: 20 },
  skipMoves: { min: 0, max: 30 },
  games: { min: 1, max: 500 },
  cardsPerDeck: 400,
} as const;

/** Maia's training data thins out beyond this range. */
export const MAIA_ELO_RANGE = { min: 600, max: 2600 } as const;
