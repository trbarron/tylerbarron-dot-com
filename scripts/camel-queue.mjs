#!/usr/bin/env node
/**
 * The Camel Up Cup waiting list: bots people submitted on the site, held in
 * Redis until a tournament is run by hand (app/utils/camelUpCup/tournament.server.ts).
 *
 *   npm run camel:queue                      list what's waiting
 *   npm run camel:queue -- pull [dir]        write each waiting bot to <dir>/<botName>.py (default ./camel-bots)
 *   npm run camel:queue -- done <id> [...]   remove bots that have played
 *   npm run camel:queue -- done --all
 *
 * Reads REDIS_URL or REDIS_TLS_URL (the npm script loads .env).
 *
 * These files are strangers' code. Read them before running them, and run the
 * tournament in a container with no network and nothing of yours mounted.
 */

import fs from 'node:fs';
import path from 'node:path';
import Redis from 'ioredis';

const PENDING_KEY = 'camelup:pending';
// The same shape the site enforces; a name that doesn't match never becomes a path.
const BOT_NAME_RE = /^[A-Za-z][A-Za-z0-9_-]{2,23}$/;

/** Oldest first. */
export function parsePending(hash) {
  return Object.values(hash)
    .map((raw) => JSON.parse(raw))
    .sort((a, b) => a.submitted.localeCompare(b.submitted));
}

/** Where a bot is written: its name, plus the id's tail when two waiting bots share a name. */
export function fileNameFor(bot, all) {
  if (!BOT_NAME_RE.test(bot.botName)) throw new Error(`Refusing unsafe bot name in ${bot.id}`);
  const shared = all.filter((b) => b.botName === bot.botName).length > 1;
  return shared ? `${bot.botName}-${bot.id.slice(-6).replace(/[^a-z0-9]/gi, '')}.py` : `${bot.botName}.py`;
}

async function main() {
  const url = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
  if (!url) throw new Error('Set REDIS_URL or REDIS_TLS_URL (in .env)');
  const [command = 'list', ...args] = process.argv.slice(2);
  const redis = new Redis(url, {
    maxRetriesPerRequest: 2,
    ...(process.env.REDIS_TLS_REJECT_UNAUTHORIZED === '0' && { tls: { rejectUnauthorized: false } }),
  });
  try {
    const bots = parsePending(await redis.hgetall(PENDING_KEY));
    if (command === 'list') {
      if (bots.length === 0) console.log('No bots waiting.');
      for (const b of bots)
        console.log(`${b.submitted}  ${b.id}  ${b.botName} by ${b.author} (${b.code.length} chars)`);
    } else if (command === 'pull') {
      const dir = path.resolve(args[0] ?? 'camel-bots');
      fs.mkdirSync(dir, { recursive: true });
      for (const b of bots) {
        const file = path.join(dir, fileNameFor(b, bots));
        fs.writeFileSync(file, b.code);
        console.log(`${file}  (${b.id}, by ${b.author})`);
      }
      console.log(`\n${bots.length} bot(s) written. Read them before running them. When they've played:`);
      console.log(`  npm run camel:queue -- done ${bots.map((b) => b.id).join(' ') || '<id>'}`);
    } else if (command === 'done') {
      const ids = args.includes('--all') ? bots.map((b) => b.id) : args;
      if (ids.length === 0) throw new Error('done needs submission ids, or --all');
      const removed = await redis.hdel(PENDING_KEY, ...ids);
      console.log(`Removed ${removed} of ${ids.length}; ${bots.length - removed} still waiting.`);
    } else {
      throw new Error(`Unknown command "${command}". Use list, pull [dir] or done <id...>.`);
    }
  } finally {
    redis.disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
