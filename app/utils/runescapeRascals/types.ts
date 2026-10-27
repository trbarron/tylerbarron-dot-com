// The snapshot the party's orchestrator (runscape-local/agents) publishes to Redis every
// 15 seconds (positions and actions) and, in slower sections, the rest. This page only reads it; the
// shape is owned by agents/dashboard.ts there and the sections by agents/lanes.ts.

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
  commitments: {
    made: number;
    done: number;
    dropped: number;
    open: number;
    carriedDone?: number;
    carriedDropped?: number;
  };
  costUsd: number;
  cacheHitRate: number;
}

export interface Bot {
  name: string;
  totalLevel: number;
  combat: number | null;
  hp: { cur: number; max: number } | null;
  /** What they are doing now, e.g. "bronze bars: step 3/5, smelt (bronze) (2 min)". */
  action: string;
  actionSince: number;
  location: string;
  pos: { x: number; z: number } | null;
  /** Recent positions, oldest first. */
  trail: { x: number; z: number }[];
  skills: Skill[];
  missing: string[];
  goal: string;
  /** The routine running now, if any: named steps run in order, optionally looping. */
  routine?: Routine | null;
  /** Their bank as last seen open (only the owner can withdraw from it). */
  bank?: { t: number; items: Record<string, number> } | null;
  deaths: number;
  /** When the screenshot was taken (ms), 0 if none yet. */
  shotAt: number;
  /** Version of the last successfully published appearance; absent on older snapshots. */
  portraitVersion?: string;
  /** Views around the figure the live portrait was rendered with; absent means the front view only. */
  portraitAngles?: number;
  portraitAt?: number;
  metrics?: BotMetrics;
}

export interface Routine {
  name: string;
  repeat: boolean;
  /** Index of the step running now. */
  step: number;
  steps: string[];
}

export type RouteOutcome = 'safe' | 'hurt' | 'died' | 'failed';

/** One road in the party's travel log, between two landmarks (by name). */
export interface Route {
  from: string;
  to: string;
  trips: number;
  safe: number;
  hurt: number;
  died: number;
  failed: number;
  last: { bot: string; t: number; outcome: RouteOutcome; note?: string };
}

/** One change to the agents and how the party did until the next one (active time only). */
export interface ScorecardRow {
  t: string;
  name: string;
  note: string;
  from: number;
  to: number;
  activeHours: number;
  decisionsPerHour: number | null;
  stepsPerHour: number | null;
  medianStepSeconds: number | null;
  blocked: number | null;
  interrupted: number | null;
  postsPerHour: number | null;
  xpPerHour: number | null;
  xpShare: { making: number; gathering: number; combat: number; thieving: number };
  deaths: number;
  milestones: number;
  costPerHour: number | null;
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

export interface Achievement {
  id: string;
  name: string;
  /** The character who unlocked it. */
  by: string;
  t: number;
}

export interface Snapshot {
  generatedAt: number;
  /** When any character last did or decided anything. Newer snapshots only. */
  lastEventAt?: number;
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
  /** Every firsts-and-marks unlock, oldest first. Newer snapshots only. */
  achievements?: Achievement[];
  landmarks: { name: string; short?: string; x: number; z: number }[];
  /** Newer snapshots only. */
  routes?: Route[];
  scorecard?: ScorecardRow[];
  party: { costPerHour: number; cacheHitRate: number; councils: number; councilsAgreed: number };
  spend: { usd: number; budgetUsd: number; calls: number; model: string };
}

/** Bot names allowed in the screenshot route (the party is fixed). */
export const BOT_NAMES = ['bram', 'wren', 'mike', 'trish'] as const;
