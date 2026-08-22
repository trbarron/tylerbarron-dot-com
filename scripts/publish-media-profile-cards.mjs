#!/usr/bin/env node
/**
 * Backfill the Media Format Appreciation Profile public list.
 *
 * Cards saved before the public list existed have no `isPublic` flag and are
 * not in the `mediaProfile:public` index, so they are reachable by their share
 * link and nowhere else. This walks the stored cards and, for the ones you
 * pick, sets the flag and adds them to the index.
 *
 * Read the two things this cannot undo for you before running it with --apply:
 *
 *   1. Nobody who filled the survey before the checkbox existed agreed to be
 *      listed. Their card carries whatever name and notes they wrote expecting
 *      a link they controlled.
 *   2. Those cards predate edit tokens, so their authors hold no proof of
 *      authorship and will never see the Edit control. Once published they
 *      cannot take themselves back down -- only this script, in reverse, can.
 *
 * Which is why nothing here writes without --apply, and why the default is to
 * list what it found and stop.
 *
 * Usage:
 *   REDIS_URL=... node scripts/publish-media-profile-cards.mjs
 *   REDIS_URL=... node scripts/publish-media-profile-cards.mjs --apply
 *   REDIS_URL=... node scripts/publish-media-profile-cards.mjs --apply --only abcdefghij,klmnpqrstu
 *   REDIS_URL=... node scripts/publish-media-profile-cards.mjs --apply --skip abcdefghij
 *   REDIS_URL=... node scripts/publish-media-profile-cards.mjs --apply --unpublish --only abcdefghij
 */

import Redis from 'ioredis';

const KEY_PREFIX = 'mediaProfile:result:';
const PUBLIC_KEY = 'mediaProfile:public';

// Matches app/utils/mediaProfile/share.server.ts. A backfilled card should not
// come out of this with a shorter life than one saved through the post.
const TTL_SECONDS = 2 * 365 * 24 * 60 * 60;

function parseArgs(argv) {
  const args = { apply: false, unpublish: false, only: null, skip: new Set() };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') args.apply = true;
    else if (arg === '--unpublish') args.unpublish = true;
    else if (arg === '--only') args.only = new Set(String(argv[++i] ?? '').split(',').filter(Boolean));
    else if (arg === '--skip') args.skip = new Set(String(argv[++i] ?? '').split(',').filter(Boolean));
    else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

/** SCAN rather than KEYS: this runs against production, next to live traffic. */
async function scanCardKeys(redis) {
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', `${KEY_PREFIX}*`, 'COUNT', 200);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');
  return keys.sort();
}

function describe(id, card, ttl) {
  const scored = Object.keys(card.scores ?? {}).filter((k) => !k.includes('.')).length;
  const notes = Object.keys(card.notes ?? {}).length;
  const days = ttl > 0 ? Math.round(ttl / 86400) : null;
  return [
    id.padEnd(12),
    (card.name ? `"${card.name}"` : '(no name)').padEnd(24),
    `${scored} scales`.padEnd(10),
    `${notes} notes`.padEnd(9),
    (card.savedAt ?? '(no date)').slice(0, 10).padEnd(11),
    card.isPublic ? 'PUBLIC' : 'private',
    days === null ? '' : ` ttl ${days}d`,
  ].join(' ');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.REDIS_URL || process.env.REDIS_TLS_URL;
  if (!url) {
    console.error('Set REDIS_URL (or REDIS_TLS_URL) to the instance holding the cards.');
    process.exit(1);
  }

  const redis = new Redis(url, {
    maxRetriesPerRequest: 3,
    ...(url.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {}),
  });

  const keys = await scanCardKeys(redis);
  if (keys.length === 0) {
    console.log('No cards stored.');
    await redis.quit();
    return;
  }

  const indexed = new Set(await redis.zrange(PUBLIC_KEY, 0, -1));
  const targetState = !args.unpublish;

  const rows = [];
  for (const key of keys) {
    const id = key.slice(KEY_PREFIX.length);
    const [raw, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);
    if (!raw) continue;

    let card;
    try {
      card = JSON.parse(raw);
    } catch {
      console.warn(`! ${id} is not parseable JSON; leaving it alone.`);
      continue;
    }

    const excluded = (args.only && !args.only.has(id)) || args.skip.has(id);
    // Already in the state we would put it in, index included.
    const settled = Boolean(card.isPublic) === targetState && indexed.has(id) === targetState;

    rows.push({ id, key, card, ttl, excluded, settled });
  }

  console.log(`\n${rows.length} card(s) in ${url.replace(/\/\/[^@]*@/, '//***@')}:\n`);
  for (const row of rows) {
    const mark = row.excluded ? '-' : row.settled ? '=' : targetState ? '+' : 'x';
    console.log(`  ${mark} ${describe(row.id, row.card, row.ttl)}`);
  }

  const changing = rows.filter((row) => !row.excluded && !row.settled);
  const verb = targetState ? 'publish' : 'unpublish';
  console.log(`\n  + / x = would ${verb}   = already there   - excluded by --only/--skip`);
  console.log(`\n${changing.length} card(s) to ${verb}.`);

  if (changing.length === 0) {
    await redis.quit();
    return;
  }

  if (!args.apply) {
    console.log('\nDry run. Re-run with --apply to write. Nothing was changed.');
    console.log('These cards were saved before the checkbox and before edit tokens existed:');
    console.log('their authors did not opt in, and cannot opt back out on their own.\n');
    await redis.quit();
    return;
  }

  for (const row of changing) {
    const next = { ...row.card };
    if (targetState) next.isPublic = true;
    else delete next.isPublic;

    // Preserve the remaining TTL rather than resetting the clock, except for a
    // key that somehow lost its expiry, which gets the standard window.
    const ttl = row.ttl > 0 ? row.ttl : TTL_SECONDS;
    await redis.set(row.key, JSON.stringify(next), 'EX', ttl);

    if (targetState) {
      const parsed = Date.parse(next.savedAt ?? '');
      await redis.zadd(PUBLIC_KEY, Number.isNaN(parsed) ? Date.now() : parsed, row.id);
    } else {
      await redis.zrem(PUBLIC_KEY, row.id);
    }
    console.log(`  ${targetState ? 'published' : 'unpublished'} ${row.id}`);
  }

  console.log(`\nDone. ${await redis.zcard(PUBLIC_KEY)} card(s) now in the public list.`);
  await redis.quit();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
