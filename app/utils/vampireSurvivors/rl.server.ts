import { getRedisClient } from '~/utils/redis.server';

// Written by the Mac training loop (vs-bot scripts/train/hrl_loop.py). Every value is JSON; lists are appended
// with RPUSH and trimmed, so they read oldest first. Each training run writes under its own prefix; the loop
// names the run in progress in `active` ({ prefix, title }), and the page falls back to the original run.
const prefix = '{vampire-survivors}:rl:mac:v1';
const originalTitle = 'Original training run';
const runKeys = (run: string) => ({
  status: `${run}:status`,
  updates: `${run}:updates`,
  evals: `${run}:evals`,
  events: `${run}:events`,
});
export const rlKeys = {
  studies: `${prefix}:studies`,
  active: '{vampire-survivors}:rl:active',
  ...runKeys(prefix),
};

export type RlEval = {
  label: string;
  set: 'eval' | 'heldout';
  update: number;
  time: string;
  pairs: number;
  medianSurvival: number | null;
  refMedianSurvival: number | null;
  pairedMedian: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  wins: number;
  ties: number;
  losses: number;
  reach15: number;
  refReach15: number;
  deathsBefore10: number;
  modeShare: Record<string, number> | null;
};

export type RlUpdate = {
  update: number;
  time: string;
  games: number;
  medianSurvival: number | null;
  meanScore: number | null;
  modeShare: Record<string, number>;
  upgradeOverrideRate: number;
  upgradeOverrides: Record<string, number>;
  rolloutMin: number | null;
};

export type RlStatus = {
  phase: string;
  detail: string;
  update: number;
  time: string;
  startedAt: string;
  gamesPlayed: number;
  gameHours: number;
  progress: { done: number; expected: number } | null;
  modes: string[];
};

export type RlEvent = { time: string; text: string };

export type RlDashboard = {
  studies: { id: string; title: string; time: string; summary: string }[];
  runTitle: string;
  available: boolean;
  status: RlStatus | null;
  updates: RlUpdate[];
  evals: RlEval[];
  events: RlEvent[];
};

type Fields = Record<string, unknown>;

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const int = (value: unknown) => {
  const parsed = num(value);
  return parsed === null ? 0 : Math.round(parsed);
};
const text = (value: unknown, limit = 200) => (typeof value === 'string' ? value.slice(0, limit) : '');
const time = (value: unknown) => {
  const raw = text(value, 40);
  return raw && !Number.isNaN(Date.parse(raw)) ? raw : '';
};

function shares(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Fields).flatMap(([key, share]) => {
      const parsed = num(share);
      return parsed === null || key.length > 32 ? [] : [[key, Math.min(1, Math.max(0, parsed))]];
    }),
  );
}

function counts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  return Object.fromEntries(
    Object.entries(value as Fields).flatMap(([key, count]) => {
      const parsed = num(count);
      return parsed === null || key.length > 32 ? [] : [[key, Math.max(0, Math.round(parsed))]];
    }),
  );
}

function parse(raw: string | null): Fields | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null;
  } catch {
    return null;
  }
}

export function parseStatus(raw: string | null): RlStatus | null {
  const fields = parse(raw);
  if (!fields || !time(fields.time)) return null;
  const progress = fields.progress as Fields | null | undefined;
  const done = num(progress?.done);
  const expected = num(progress?.expected);
  return {
    phase: text(fields.phase, 40) || 'unknown',
    detail: text(fields.detail),
    update: int(fields.update),
    time: time(fields.time),
    startedAt: time(fields.startedAt),
    gamesPlayed: int(fields.gamesPlayed),
    gameHours: num(fields.gameHours) ?? 0,
    progress: done !== null && expected ? { done: Math.round(done), expected: Math.round(expected) } : null,
    modes: Array.isArray(fields.modes) ? fields.modes.filter((mode): mode is string => typeof mode === 'string') : [],
  };
}

export function parseUpdate(raw: string): RlUpdate | null {
  const fields = parse(raw);
  if (!fields || num(fields.update) === null) return null;
  return {
    update: int(fields.update),
    time: time(fields.time),
    games: int(fields.games),
    medianSurvival: num(fields.medianSurvival),
    meanScore: num(fields.meanScore),
    modeShare: shares(fields.modeShare),
    upgradeOverrideRate: num(fields.upgradeOverrideRate) ?? 0,
    upgradeOverrides: counts(fields.upgradeOverrides),
    rolloutMin: num(fields.rolloutMin),
  };
}

export function parseEval(raw: string): RlEval | null {
  const fields = parse(raw);
  if (!fields || num(fields.update) === null || (fields.set !== 'eval' && fields.set !== 'heldout')) return null;
  return {
    label: text(fields.label, 40),
    set: fields.set,
    update: int(fields.update),
    time: time(fields.time),
    pairs: int(fields.pairs),
    medianSurvival: num(fields.medianSurvival),
    refMedianSurvival: num(fields.refMedianSurvival),
    pairedMedian: num(fields.pairedMedian),
    ciLow: num(fields.ciLow),
    ciHigh: num(fields.ciHigh),
    wins: int(fields.wins),
    ties: int(fields.ties),
    losses: int(fields.losses),
    reach15: int(fields.reach15),
    refReach15: int(fields.refReach15),
    deathsBefore10: int(fields.deathsBefore10),
    modeShare: fields.modeShare ? shares(fields.modeShare) : null,
  };
}

export function parseEvent(raw: string): RlEvent | null {
  const fields = parse(raw);
  if (!fields || !time(fields.time)) return null;
  return { time: time(fields.time), text: text(fields.text, 300) };
}

const present = <T>(value: T | null): value is T => value !== null;

/** The run named by the `active` key, if it names a valid run prefix. */
export function parseActiveRun(raw: string | null): { prefix: string; title: string } | null {
  const fields = parse(raw);
  const run = text(fields?.prefix, 80);
  const title = text(fields?.title, 80).trim();
  return /^\{vampire-survivors\}:rl:[a-z0-9-]+:v\d+$/.test(run) && title ? { prefix: run, title } : null;
}

export async function readRlDashboard(): Promise<RlDashboard> {
  try {
    const redis = getRedisClient();
    const active = parseActiveRun(await redis.get(rlKeys.active));
    const keys = runKeys(active?.prefix ?? prefix);
    const [status, updates, evals, events, studies] = await redis
      .multi()
      .get(keys.status)
      .lrange(keys.updates, -600, -1)
      .lrange(keys.evals, -200, -1)
      .lrange(keys.events, -40, -1)
      .hgetall(rlKeys.studies)
      .exec()
      .then((replies) => (replies ?? []).map(([error, value]) => (error ? null : value)));
    const list = (value: unknown) =>
      Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
    return {
      studies: Object.entries(studies ?? {})
        .flatMap(([id, raw]) => {
          const row = typeof raw === 'string' ? parse(raw) : null;
          if (!row || !text(row.title) || !time(row.time) || !text(row.summary)) return [];
          return [{ id, title: text(row.title), time: time(row.time), summary: text(row.summary, 2000) }];
        })
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time)),
      runTitle: active?.title ?? originalTitle,
      available: true,
      status: parseStatus(typeof status === 'string' ? status : null),
      updates: list(updates).map(parseUpdate).filter(present),
      evals: list(evals).map(parseEval).filter(present),
      events: list(events).map(parseEvent).filter(present).reverse(),
    };
  } catch (error) {
    console.error('Vampire Survivors RL dashboard read failed:', error);
    return { studies: [], runTitle: originalTitle, available: false, status: null, updates: [], evals: [], events: [] };
  }
}
