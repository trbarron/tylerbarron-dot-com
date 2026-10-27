// Reads what the party's orchestrator publishes. It runs on a separate machine and writes
// these keys (7-day expiry); this site never writes them. See SECTIONS below for the pieces; a
// publisher from before the split wrote the whole snapshot to `runescapeRascals:snapshot` as plain JSON.

import { gunzipSync } from 'zlib';
import { getRedisClient } from '~/utils/redis.server';
import type { Bot, Snapshot } from './types';

const SNAPSHOT_KEY = 'runescapeRascals:snapshot';

const FAST_KEY = `${SNAPSHOT_KEY}:fast`;

/**
 * The publisher writes the snapshot in pieces to keep the Redis network allowance in check:
 * `snapshot:fast` (JSON; positions, actions and the liveness stamp, every 15 seconds) and gzipped
 * sections that change slowly. A server instance reuses each section for `reuseMs`, about half the
 * publisher's cadence for it, instead of fetching it on every request.
 */
const SECTIONS = {
  core: { reuseMs: 30_000 },
  log: { reuseMs: 30_000 },
  history: { reuseMs: 150_000 },
  routes: { reuseMs: 150_000 },
  achievements: { reuseMs: 150_000 },
  scorecard: { reuseMs: 150_000 },
} as const;
type SectionName = keyof typeof SECTIONS;

type FastBot = Pick<Bot, 'name' | 'action' | 'actionSince' | 'location' | 'pos' | 'hp'>;
type FastLane = Pick<Snapshot, 'generatedAt' | 'lastEventAt' | 'uptimeMin'> & { bots: FastBot[] };
type Parts = Partial<Record<SectionName, Record<string, unknown>>>;

const sectionCache = new Map<SectionName, { value: Record<string, unknown> | null; at: number }>();

async function readSection(name: SectionName): Promise<Record<string, unknown> | null> {
  const cached = sectionCache.get(name);
  if (cached && Date.now() - cached.at < SECTIONS[name].reuseMs) return cached.value;
  const buf = await getRedisClient().getBuffer(`${SNAPSHOT_KEY}:${name}`);
  const value = buf ? (JSON.parse(gunzipSync(buf).toString()) as Record<string, unknown>) : null;
  sectionCache.set(name, { value, at: Date.now() });
  return value;
}

/** Put the pieces back together: the core's bots get the fast lane's position, action and hp. */
export function assembleSnapshot(fast: FastLane | null, parts: Parts): Snapshot | null {
  const core = parts.core;
  if (!fast || !core) return null;
  const byName = new Map(fast.bots.map((b) => [b.name, b]));
  const bots = (core.bots as Bot[]).map((b) => ({ ...b, ...byName.get(b.name) }));
  return {
    log: [],
    history: [],
    ...core,
    ...parts.log,
    ...parts.history,
    ...parts.routes,
    ...parts.achievements,
    ...parts.scorecard,
    generatedAt: fast.generatedAt,
    lastEventAt: fast.lastEventAt,
    uptimeMin: fast.uptimeMin,
    bots,
  } as unknown as Snapshot;
}

/** The snapshot as one piece, as publishers wrote it before it was split. */
async function readLegacySnapshot(): Promise<Snapshot | null> {
  const raw = await getRedisClient().get(SNAPSHOT_KEY);
  return raw ? (JSON.parse(raw) as Snapshot) : null;
}

/** The latest snapshot, or null if the party has not published in the last week. */
export async function readSnapshot(): Promise<Snapshot | null> {
  const fastRaw = await getRedisClient().get(FAST_KEY);
  const fast = fastRaw ? (JSON.parse(fastRaw) as FastLane) : null;
  const names = Object.keys(SECTIONS) as SectionName[];
  const values = fast ? await Promise.all(names.map(readSection)) : [];
  const parts = Object.fromEntries(names.flatMap((n, i) => (values[i] ? [[n, values[i]]] : []))) as Parts;
  return assembleSnapshot(fast, parts) ?? readLegacySnapshot();
}
