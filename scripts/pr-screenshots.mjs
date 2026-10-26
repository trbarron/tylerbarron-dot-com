#!/usr/bin/env node
/**
 * Before/after screenshots for a PR that changes how a page looks.
 *
 *   node scripts/pr-screenshots.mjs --route /runescape-rascals \
 *     --env-file ../runscape-local/.env --open "summary:has-text('Achievements')"
 *
 * "Before" is production, "after" is this checkout: the script starts `npm run dev` if
 * nothing answers on --local, shoots both at desktop and phone width, then stops what it
 * started. Files land in --out (default ~/Desktop/pr-screenshots/<branch>), never in the
 * checkout. GitHub has no API for attaching images, so unless --no-comment is given they are
 * pushed to an images-only `pr-screenshots` branch (outside master's history, one folder per
 * PR) and linked from a PR comment that later runs update in place. Needs a public repo and
 * `gh` logged in; with no open PR for the branch, it only saves the files.
 *
 *   --route      page path (default /)
 *   --prod       production origin (default https://tylerbarron.com)
 *   --local      local origin (default http://localhost:5173)
 *   --out        output directory
 *   --widths     comma list of viewport widths (default 1280,390)
 *   --open       CSS selector clicked on the "after" page for one extra shot with it open
 *                (a closed <details> summary, say); skipped quietly if it is not there
 *   --focus      CSS/text selector of one element, shot on its own at each width too
 *                (a chart panel, say); the open target's panel is cropped the same way
 *   --no-comment  save the files only: no push, no PR comment
 *   --env-file   a .env to borrow variables from for the dev server (only --env-keys)
 *   --env-keys   comma list of variables to take from it (default REDIS_URL,REDIS_TLS_URL)
 *
 * A page that reads live data shows live data: run it while the data is worth showing.
 */

import { spawn, execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};

const route = flag('route', '/');
const prod = flag('prod', 'https://tylerbarron.com').replace(/\/$/, '');
const local = flag('local', 'http://localhost:5173').replace(/\/$/, '');
const widths = flag('widths', '1280,390').split(',').map(Number);
const open = flag('open');
const focus = flag('focus');
const root = path.resolve(import.meta.dirname, '..');
const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root }).toString().trim().replace(/\//g, '-');
const out = flag('out', path.join(os.homedir(), 'Desktop', 'pr-screenshots', branch)).replace(/^~/, os.homedir());
const label = (w) => (w <= 600 ? 'phone' : 'desktop');

// Borrow just the named variables from another project's .env, never the whole file.
const env = { ...process.env };
const envFile = flag('env-file');
if (envFile) {
  const keys = flag('env-keys', 'REDIS_URL,REDIS_TLS_URL').split(',');
  for (const line of fs.readFileSync(path.resolve(envFile), 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && keys.includes(m[1])) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const answering = (url) =>
  fetch(url, { signal: AbortSignal.timeout(3000) }).then(
    () => true,
    () => false,
  );

let server = null;
if (!(await answering(local))) {
  console.log(`starting the dev server for ${local} ...`);
  server = spawn('npm', ['run', 'dev'], { cwd: root, env, stdio: 'ignore', detached: true });
  const deadline = Date.now() + 120_000;
  while (!(await answering(local))) {
    if (Date.now() > deadline) {
      process.kill(-server.pid);
      throw new Error('the dev server did not come up in 2 minutes');
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const written = [];
try {
  for (const width of widths) {
    for (const [name, origin] of [
      ['before', prod],
      ['after', local],
    ]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(origin + route, { waitUntil: 'networkidle', timeout: 60_000 });
      const base = `${name}-${label(width)}`;
      await page.screenshot({ path: path.join(out, `${base}.png`), fullPage: true });
      written.push(`${base}.png`);
      if (focus) {
        const el = page.locator(focus).first();
        if (await el.count()) {
          await el.screenshot({ path: path.join(out, `${base}-focus.png`) });
          written.push(`${base}-focus.png`);
        }
      }
      if (open && name === 'after') {
        const target = page.locator(open).first();
        if (await target.count()) {
          await target.click();
          await page.screenshot({ path: path.join(out, `${base}-open.png`), fullPage: true });
          written.push(`${base}-open.png`);
          await target.locator('xpath=..').screenshot({ path: path.join(out, `${base}-open-panel.png`) });
          written.push(`${base}-open-panel.png`);
        }
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  if (server) process.kill(-server.pid);
}

console.log(`${written.length} screenshots in ${out}:\n  ${written.join('\n  ')}`);

// ---------------------------------------------------------------------------- PR comment

const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const MARKER = '<!-- pr-screenshots -->';
const BRANCH = 'pr-screenshots';

async function postComment() {
  let pr;
  try {
    pr = JSON.parse(run('gh', ['pr', 'view', '--json', 'number,headRefName']));
  } catch {
    console.log('no open PR for this branch: files saved, nothing posted');
    return;
  }
  const repo = JSON.parse(run('gh', ['repo', 'view', '--json', 'nameWithOwner,visibility,url']));
  if (repo.visibility !== 'PUBLIC') {
    console.log('the repo is private, so its images would not render in a comment: files saved, nothing posted');
    return;
  }

  // An images-only branch, committed from a scratch clone so the checkout is never touched.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-screenshots-'));
  const url = `${repo.url}.git`;
  try {
    const exists = run('git', ['ls-remote', '--heads', url, BRANCH]).length > 0;
    if (exists) run('git', ['clone', '--quiet', '--depth', '1', '--branch', BRANCH, url, scratch]);
    else {
      run('git', ['init', '--quiet', '-b', BRANCH], scratch);
      run('git', ['remote', 'add', 'origin', url], scratch);
    }
    const dir = path.join(scratch, `pr-${pr.number}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    for (const f of written) fs.copyFileSync(path.join(out, f), path.join(dir, f));
    run('git', ['add', '-A'], scratch);
    run(
      'git',
      [
        '-c',
        'user.name=pr-screenshots',
        '-c',
        'user.email=pr-screenshots@users.noreply.github.com',
        'commit',
        '--quiet',
        '-m',
        `screenshots for #${pr.number}`,
      ],
      scratch,
    );
    run('git', ['push', '--quiet', 'origin', BRANCH], scratch);
    const sha = run('git', ['rev-parse', 'HEAD'], scratch);
    const raw = (f) => `https://raw.githubusercontent.com/${repo.nameWithOwner}/${sha}/pr-${pr.number}/${f}`;
    const img = (f, alt) => `<img src="${raw(f)}" alt="${alt}" width="100%">`;
    const has = (f) => written.includes(f);

    const sections = [];
    for (const width of widths) {
      const w = label(width);
      // Prefer the focused crop for the pair: a full page is mostly the part nobody changed.
      const key = has(`before-${w}-focus.png`) ? `${w}-focus` : w;
      const rows = [
        `| Before | After |`,
        `|---|---|`,
        `| ${has(`before-${key}.png`) ? img(`before-${key}.png`, `before, ${w}`) : '_not on production yet_'} | ${img(`after-${key}.png`, `after, ${w}`)} |`,
      ];
      let block = `### ${w[0].toUpperCase()}${w.slice(1)} (${width}px)\n\n${rows.join('\n')}`;
      if (has(`after-${w}-open-panel.png`))
        block += `\n\nOpened:\n\n${img(`after-${w}-open-panel.png`, `opened, ${w}`)}`;
      block += `\n\n<details><summary>Full page</summary>\n\n| Before | After |\n|---|---|\n| ${img(`before-${w}.png`, `before full page, ${w}`)} | ${img(`after-${w}.png`, `after full page, ${w}`)} |\n\n</details>`;
      sections.push(block);
    }
    const body = `${MARKER}\n## Screenshots\n\nProduction vs. this branch, live data. Made by \`npm run pr-screenshots\`; re-running it updates this comment.\n\n${sections.join('\n\n')}\n`;

    const comments = JSON.parse(
      run('gh', ['api', `repos/${repo.nameWithOwner}/issues/${pr.number}/comments`, '--paginate']),
    );
    const mine = comments.find((c) => c.body?.startsWith(MARKER));
    const file = path.join(scratch, 'comment.md');
    fs.writeFileSync(file, body);
    if (mine)
      run('gh', [
        'api',
        '--method',
        'PATCH',
        `repos/${repo.nameWithOwner}/issues/comments/${mine.id}`,
        '-F',
        `body=@${file}`,
      ]);
    else run('gh', ['pr', 'comment', String(pr.number), '--body-file', file]);
    console.log(`${mine ? 'updated' : 'posted'} the screenshots comment on PR #${pr.number}`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (!argv.includes('--no-comment')) await postComment();
