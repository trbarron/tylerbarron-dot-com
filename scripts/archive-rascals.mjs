// Usage: node --env-file=<publisher .env> scripts/archive-rascals.mjs <snapshot.json>
// Archives the existing public dashboard only; never starts agents or spends model credits.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import Redis from 'ioredis';

const snapshot = JSON.parse(readFileSync(process.argv[2], 'utf8'));
if (
  !Number.isFinite(snapshot.generatedAt) ||
  !Array.isArray(snapshot.bots) ||
  !snapshot.bots.length ||
  !Array.isArray(snapshot.log) ||
  !Array.isArray(snapshot.history)
)
  throw new Error('Invalid snapshot');
const url = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
if (!url) throw new Error('REDIS_URL required');
const redis = new Redis(url, { maxRetriesPerRequest: 1, retryStrategy: () => null });
try {
  // A separate key is unaffected by the publisher’s seven-day TTL.
  await redis.set('runescapeRascals:archive', gzipSync(JSON.stringify(snapshot)));
  console.log(
    `Archived ${new Date(snapshot.generatedAt).toISOString()}; TTL ${await redis.ttl('runescapeRascals:archive')} (no expiry)`,
  );
} finally {
  await redis.quit();
}
