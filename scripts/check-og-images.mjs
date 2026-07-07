#!/usr/bin/env node
/**
 * CI guard: verify posts' static assets are present and up to date.
 *
 * 1. OG share cards: `scripts/generate-og-image.py` renders
 *    public/images/og/<slug>.png for each posts/*.mdx and records the
 *    frontmatter it rendered from in public/images/og/manifest.json. This
 *    script cross-checks that manifest (and the PNGs) against the current
 *    posts, failing when a card is missing or was rendered from outdated
 *    title/date frontmatter. Cards can't be re-rendered for comparison in CI
 *    because the generator uses local system fonts.
 *
 * 2. Image references: every /images/... path referenced in an MDX post must
 *    exist under public/images/ with the exact same casing. macOS's
 *    case-insensitive filesystem masks case mismatches locally, but S3 is
 *    case-sensitive, so a mismatch 403s in production (goodGeometryEquation
 *    incident).
 *
 * Dependency-free on purpose so CI can run it without `npm ci`.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const postsDir = path.join(root, 'posts');
const ogDir = path.join(root, 'public', 'images', 'og');
const manifestPath = path.join(ogDir, 'manifest.json');

const FIX = 'Run: python3 scripts/generate-og-image.py  (then commit public/images/og/)';

/** Minimal frontmatter reader; mirrors read_frontmatter in generate-og-image.py. */
function readFrontmatter(mdxPath) {
  const text = fs.readFileSync(mdxPath, 'utf-8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return {};
  const fields = {};
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+?)\s*$/);
    if (kv) fields[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return fields;
}

if (!fs.existsSync(manifestPath)) {
  console.error(`❌ ${path.relative(root, manifestPath)} is missing. ${FIX}`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

const slugs = fs
  .readdirSync(postsDir)
  .filter((f) => f.endsWith('.mdx'))
  .map((f) => f.replace(/\.mdx$/, ''));

/** True when relPath exists under baseDir with exact casing at every segment. */
function existsCaseSensitive(baseDir, relPath) {
  let dir = baseDir;
  const segments = relPath.split('/');
  for (let i = 0; i < segments.length; i++) {
    if (!fs.existsSync(dir) || !fs.readdirSync(dir).includes(segments[i])) return false;
    dir = path.join(dir, segments[i]);
  }
  return true;
}

const problems = [];
for (const slug of slugs) {
  const source = fs.readFileSync(path.join(postsDir, `${slug}.mdx`), 'utf-8');
  for (const ref of source.match(/\/images\/[A-Za-z0-9_./-]+\.[a-z0-9]+/g) ?? []) {
    if (!existsCaseSensitive(path.join(root, 'public', 'images'), ref.replace('/images/', ''))) {
      problems.push(`${slug}: references ${ref}, which does not exist in public/images/ (check exact casing)`);
    }
  }
}
for (const slug of slugs) {
  const fm = readFrontmatter(path.join(postsDir, `${slug}.mdx`));
  if (!fm.title) {
    problems.push(`${slug}: no title frontmatter, cannot have an OG card`);
    continue;
  }
  const entry = manifest[slug];
  if (!entry || !fs.existsSync(path.join(ogDir, `${slug}.png`))) {
    problems.push(`${slug}: OG card missing`);
  } else if (entry.title !== fm.title || entry.date !== (fm.date ?? '')) {
    problems.push(
      `${slug}: OG card is stale (rendered from title "${entry.title}" / date "${entry.date}", frontmatter now "${fm.title}" / "${fm.date ?? ''}")`,
    );
  }
}

// Cards for deleted posts are clutter, not breakage — warn without failing.
for (const slug of Object.keys(manifest)) {
  if (!slugs.includes(slug)) {
    console.warn(`⚠️  ${slug}: OG card has no matching post (delete it or re-run the generator)`);
  }
}

if (problems.length > 0) {
  console.error('❌ Post assets are out of sync with posts/:\n');
  for (const p of problems) console.error(`   - ${p}`);
  console.error(`\nFor missing/stale OG cards — ${FIX}`);
  console.error('For image references — fix the path (or casing) in the post.');
  process.exit(1);
}

console.log(`✅ OG cards + image references OK for all ${slugs.length} posts`);
