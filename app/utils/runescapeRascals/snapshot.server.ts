// Reads what the party's orchestrator publishes. It runs on a separate machine and writes
// these keys (7-day expiry); this site never writes them.

import { getRedisClient } from '~/utils/redis.server';
import type { Snapshot } from './types';

const SNAPSHOT_KEY = 'runescapeRascals:snapshot';
const shotKey = (name: string) => `runescapeRascals:shot:${name}`;

/** The latest snapshot, or null if the party has not published in the last week. */
export async function readSnapshot(): Promise<Snapshot | null> {
  const raw = await getRedisClient().get(SNAPSHOT_KEY);
  return raw ? (JSON.parse(raw) as Snapshot) : null;
}

/** The latest in-game screenshot for a bot (JPEG bytes), or null. */
export async function readShot(name: string): Promise<Buffer | null> {
  return getRedisClient().getBuffer(shotKey(name));
}
