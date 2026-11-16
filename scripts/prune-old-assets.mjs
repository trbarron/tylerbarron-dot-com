#!/usr/bin/env node
/**
 * Delete hashed build assets from the CDN bucket once they are old enough that
 * nothing can still point at them.
 *
 * The deploy uploads build/client/assets/ without --delete, because the
 * previous build's files are still referenced by the Lambda in production
 * until the deploy finishes, by cached HTML, and by tabs that are already
 * open. This runs after the deploy and removes files under assets/ that are
 * both older than MAX_AGE_DAYS and absent from the build just shipped.
 *
 * Age alone is not enough (an S3 lifecycle rule would be wrong here): a file
 * whose content did not change keeps its name and its old upload date, and a
 * month with no deploys would expire the live site's assets.
 *
 * Uses the aws CLI, which the deploy runner already has. Dependency-free.
 *   AWS_BUCKET_NAME=... node scripts/prune-old-assets.mjs [--dry-run]
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAX_AGE_DAYS = 30;
const PREFIX = 'assets/';

/** Keys under assets/ that are safe to delete: old, and not part of the current build. */
export function prunable(objects, currentKeys, now = Date.now(), maxAgeDays = MAX_AGE_DAYS) {
  const cutoff = now - maxAgeDays * 24 * 60 * 60 * 1000;
  return objects
    .filter((o) => o.Key.startsWith(PREFIX) && !currentKeys.has(o.Key) && new Date(o.LastModified).getTime() < cutoff)
    .map((o) => o.Key);
}

function main() {
  const bucket = process.env.AWS_BUCKET_NAME;
  const dryRun = process.argv.includes('--dry-run');
  const buildDir = path.resolve(import.meta.dirname, '..', 'build', 'client', 'assets');
  if (!bucket) throw new Error('AWS_BUCKET_NAME is required');
  // Without the build there is no way to tell live files from stale ones.
  if (!fs.existsSync(buildDir)) throw new Error(`No build at ${buildDir}; refusing to prune`);

  const current = new Set(
    fs
      .readdirSync(buildDir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => PREFIX + path.relative(buildDir, path.join(e.parentPath, e.name)).split(path.sep).join('/')),
  );
  if (current.size === 0) throw new Error('The build has no assets; refusing to prune');

  // The CLI follows pagination itself and returns one merged list.
  const listed = JSON.parse(
    execFileSync(
      'aws',
      [
        's3api',
        'list-objects-v2',
        '--bucket',
        bucket,
        '--prefix',
        PREFIX,
        '--query',
        'Contents[].{Key:Key,LastModified:LastModified}',
        '--output',
        'json',
      ],
      { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
    ) || 'null',
  );
  const stale = prunable(listed ?? [], current);
  console.log(
    `${listed?.length ?? 0} objects under ${PREFIX}, ${current.size} in this build, ${stale.length} to prune.`,
  );

  for (let i = 0; i < stale.length; i += 1000) {
    const batch = stale.slice(i, i + 1000);
    if (dryRun) {
      for (const key of batch) console.log(`  would delete ${key}`);
      continue;
    }
    execFileSync(
      'aws',
      [
        's3api',
        'delete-objects',
        '--bucket',
        bucket,
        '--delete',
        JSON.stringify({ Objects: batch.map((Key) => ({ Key })), Quiet: true }),
      ],
      { stdio: 'inherit' },
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
