#!/usr/bin/env node
// Read-only backup of the site's Redis to a JSON file: every key with its type,
// exact bytes (base64), absolute expiry, and a content digest that
// redis-restore.mjs checks after restoring. Works on any Redis version, no DUMP.
//
//   node --env-file=.env scripts/redis-backup.mjs [out.json]
//
// Reads REDIS_URL or REDIS_TLS_URL. Default output: ~/redis-backups/redis-<host>-<time>.json.
// The file holds user data (decks, usernames, shared profiles): keep it out of the repo.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Redis from 'ioredis';

const b64 = (buf) => buf.toString('base64');

/** Type-aware content, byte-exact, in a canonical order. */
export async function readValue(redis, key, type) {
  switch (type) {
    case 'string':
      return b64(await redis.getBuffer(key));
    case 'hash': {
      const flat = await redis.hgetallBuffer(key);
      return Object.entries(flat)
        .map(([f, v]) => [b64(Buffer.from(f)), b64(v)])
        .sort((a, b) => (a[0] < b[0] ? -1 : 1));
    }
    case 'list':
      return (await redis.lrangeBuffer(key, 0, -1)).map(b64);
    case 'set':
      return (await redis.smembersBuffer(key)).map(b64).sort();
    case 'zset': {
      const flat = await redis.zrangeBuffer(key, 0, -1, 'WITHSCORES');
      const pairs = [];
      for (let i = 0; i < flat.length; i += 2) pairs.push([b64(flat[i]), Number(flat[i + 1].toString())]);
      return pairs.sort((a, b) => (a[0] < b[0] ? -1 : 1));
    }
    default:
      throw new Error(`${key}: unsupported type ${type}`);
  }
}

export const digest = (type, value) =>
  createHash('sha256')
    .update(JSON.stringify([type, value]))
    .digest('hex');

async function main() {
  const url = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
  if (!url) throw new Error('Set REDIS_URL or REDIS_TLS_URL (e.g. node --env-file=.env ...)');
  const { hostname } = new URL(url);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out =
    process.argv[2] ?? path.join(os.homedir(), 'redis-backups', `redis-${hostname.split('.')[0]}-${stamp}.json`);
  const redis = new Redis(url, { ...(url.startsWith('rediss') ? { tls: {} } : {}), maxRetriesPerRequest: 3 });
  const takenAt = Date.now();
  const version = (await redis.info('server')).match(/redis_version:(\S+)/)?.[1];
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'COUNT', 1000);
    cursor = next;
    for (const key of batch) {
      const type = await redis.type(key);
      if (type === 'none') continue; // expired mid-scan
      const pttl = await redis.pttl(key);
      const value = await readValue(redis, key, type);
      keys.push({ key, type, expireAt: pttl > 0 ? takenAt + pttl : null, value, digest: digest(type, value) });
    }
  } while (cursor !== '0');
  await redis.quit();

  keys.sort((a, b) => (a.key < b.key ? -1 : 1));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ takenAt, source: { host: hostname, version }, keys }, null, 1), {
    mode: 0o600,
  });

  const byType = keys.reduce((acc, k) => ({ ...acc, [k.type]: (acc[k.type] ?? 0) + 1 }), {});
  console.log(`Backed up ${keys.length} keys from ${hostname} (Redis ${version}) to ${out}`);
  console.log(`  by type: ${JSON.stringify(byType)}; without expiry: ${keys.filter((k) => !k.expireAt).length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
