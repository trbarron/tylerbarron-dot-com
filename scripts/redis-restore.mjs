#!/usr/bin/env node
// Restore a redis-backup.mjs file into a Redis, then verify every key's
// contents against the backup's digests.
//
//   node --env-file=.env scripts/redis-restore.mjs <backup.json> [--include-legacy] [--merge]
//
// Target: TARGET_REDIS_URL if set, else REDIS_URL / REDIS_TLS_URL.
// - Expiries are kept as absolute times: a key that expired since the backup is skipped.
// - Old Python-server Collaborative Checkmate keys (game:*) are skipped unless --include-legacy.
// - Refuses a target that already has keys unless --merge, which only adds keys
//   the target doesn't have (for a second pass after the cutover).

import fs from 'node:fs';
import Redis from 'ioredis';
import { digest, readValue } from './redis-backup.mjs';

const [file, ...flags] = process.argv.slice(2);
if (!file) throw new Error('Usage: redis-restore.mjs <backup.json> [--include-legacy] [--merge]');
const includeLegacy = flags.includes('--include-legacy');
const merge = flags.includes('--merge');
const url = process.env.TARGET_REDIS_URL || process.env.REDIS_URL || process.env.REDIS_TLS_URL;
if (!url) throw new Error('Set TARGET_REDIS_URL (or REDIS_URL / REDIS_TLS_URL)');
const { hostname } = new URL(url);

const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
const redis = new Redis(url, { ...(url.startsWith('rediss') ? { tls: {} } : {}), maxRetriesPerRequest: 3 });
const buf = (s) => Buffer.from(s, 'base64');

const existing = await redis.dbsize();
if (existing > 0 && !merge) {
  await redis.quit();
  throw new Error(`${hostname} already has ${existing} keys. Use --merge to add only missing keys.`);
}

const now = Date.now();
const counts = { restored: 0, alreadyThere: 0, expired: 0, legacy: 0 };
const restored = [];
for (const k of backup.keys) {
  if (!includeLegacy && k.key.startsWith('game:')) {
    counts.legacy++;
    continue;
  }
  if (k.expireAt !== null && k.expireAt <= now) {
    counts.expired++;
    continue;
  }
  if (await redis.exists(k.key)) {
    counts.alreadyThere++;
    continue;
  }
  const tx = redis.multi();
  switch (k.type) {
    case 'string':
      tx.set(k.key, buf(k.value));
      break;
    case 'hash':
      tx.hset(k.key, ...k.value.flatMap(([f, v]) => [buf(f), buf(v)]));
      break;
    case 'list':
      tx.rpush(k.key, ...k.value.map(buf));
      break;
    case 'set':
      tx.sadd(k.key, ...k.value.map(buf));
      break;
    case 'zset':
      tx.zadd(k.key, ...k.value.flatMap(([m, score]) => [score, buf(m)]));
      break;
    default:
      throw new Error(`${k.key}: unsupported type ${k.type}`);
  }
  if (k.expireAt !== null) tx.pexpireat(k.key, k.expireAt);
  await tx.exec();
  counts.restored++;
  restored.push(k);
}

// Verify: re-read every restored key and compare with the backup's digest.
const mismatched = [];
for (const k of restored) {
  const type = await redis.type(k.key);
  if (type !== k.type || digest(type, await readValue(redis, k.key, type)) !== k.digest) mismatched.push(k.key);
}
const version = (await redis.info('server')).match(/redis_version:(\S+)/)?.[1];
await redis.quit();

console.log(
  `Restored into ${hostname} (Redis ${version}) from ${file} (taken ${new Date(backup.takenAt).toISOString()})`,
);
console.log(`  ${JSON.stringify(counts)}`);
if (mismatched.length) {
  console.error(`  ✗ ${mismatched.length} keys differ from the backup: ${mismatched.slice(0, 10).join(', ')}`);
  process.exit(1);
}
console.log(`  ✓ all ${restored.length} restored keys match the backup byte for byte`);
