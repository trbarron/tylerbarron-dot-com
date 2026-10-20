// The snapshot the party's orchestrator (runscape-local/agents) publishes to Redis every
// 15 seconds. This page only reads it; the shape is owned by agents/dashboard.ts there.

export interface Skill {
  name: string;
  level: number;
}

export interface BotMetrics {
  /** Null for the first ten minutes of a run, when rates are noise. */
  decisionsPerHour: number | null;
  xpPerHour: number | null;
  repeatRate: number;
  rest: number;
  leaningAlignment: number | null;
  commitments: { made: number; done: number; dropped: number; open: number };
  costUsd: number;
  cacheHitRate: number;
}

export interface Bot {
  name: string;
  totalLevel: number;
  combat: number | null;
  hp: { cur: number; max: number } | null;
  /** The current standing order, e.g. "mine (copper) until Mining 15 (3 min)". */
  action: string;
  actionSince: number;
  location: string;
  pos: { x: number; z: number } | null;
  /** Recent positions, oldest first. */
  trail: { x: number; z: number }[];
  skills: Skill[];
  missing: string[];
  goal: string;
  deaths: number;
  /** When the screenshot was taken (ms), 0 if none yet. */
  shotAt: number;
  metrics?: BotMetrics;
}

export interface Milestone {
  id: number;
  what: string;
  needs: string;
  done: boolean;
}

export interface Mission {
  mission: string;
  title: string;
  why: string;
  milestones: Milestone[];
  proposedBy: string;
  council: number;
  set: number;
  unanimous: boolean;
}

export interface Post {
  id: number;
  t: number;
  from: string;
  to: string;
  text: string;
  council?: number;
}

export interface LogEntry {
  t: number;
  bot: string;
  kind: string;
  title: string;
  detail?: string;
}

export interface Snapshot {
  generatedAt: number;
  uptimeMin: number;
  partyTotal: number;
  bots: Bot[];
  plan: {
    council: number;
    made: number;
    agreed: boolean;
    entries: Record<string, { commitment: string; asks: { to: string; what: string }[] }>;
  } | null;
  teamGoal: Mission | null;
  board: Post[];
  log: LogEntry[];
  history: { t: number; levels: Record<string, number> }[];
  landmarks: { name: string; short?: string; x: number; z: number }[];
  party: { costPerHour: number; cacheHitRate: number; councils: number; councilsAgreed: number };
  spend: { usd: number; budgetUsd: number; calls: number; model: string };
}

/** Bot names allowed in the screenshot route (the party is fixed). */
export const BOT_NAMES = ['bram', 'wren', 'mike', 'trish'] as const;
