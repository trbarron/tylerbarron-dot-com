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
 *   --full-page  show full-page comparisons instead of automatic difference crops
 *   --focus      CSS/text selector of one element, shot on its own at each width too
 *                (a chart panel, say); the open target's panel is cropped the same way
 *   --hover      "<selector>@<x>,<y>": move the pointer to that fraction (0-1) of the element's box
 *                on the "after" page and shoot the element; repeat the flag for more shots
 *   --config     repository capture settings (default pr-screenshots.config.json)
 *   --reuse-server explicitly allow an already running server after verifying its checkout
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
import { writeDifferenceCrops } from './lib/screenshot-diff.mjs';
import {
  readCaptureConfig,
  captureWidths,
  widthLabel,
  serverCommand,
  readyForCapture,
  revealFocus,
  openControl,
} from './lib/pr-screenshots.mjs';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};

const root = path.resolve(import.meta.dirname, '..');
const config = readCaptureConfig(root, flag('config', 'pr-screenshots.config.json'));
const route = flag('route', '/');
const prod = flag('prod', config.productionUrl).replace(/\/$/, '');
const local = flag('local', config.localUrl).replace(/\/$/, '');
const widths = captureWidths(flag('widths', config.widths ?? [1280, 390]));
const open = flag('open');
const focus = flag('focus');
const hovers = argv.flatMap((a, i) => (a === '--hover' ? [argv[i + 1]] : []));
const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: root }).toString().trim().replace(/\//g, '-');
const out = flag('out', path.join(os.homedir(), 'Desktop', 'pr-screenshots', branch)).replace(/^~/, os.homedir());
const label = widthLabel;

// Borrow just the named variables from another project's .env, never the whole file.
const env = { ...process.env };
const envFile = flag('env-file');
if (envFile) {
  const keys = flag('env-keys', (config.envKeys ?? []).join(',')).split(',');
  for (const line of fs.readFileSync(path.resolve(envFile), 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && keys.includes(m[1])) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
}

const answering = (url) =>
  fetch(url, { signal: AbortSignal.timeout(3000) }).then(
    (response) => response.ok,
    () => false,
  );

let server = null;
let browser = null;
const written = [];
const cleanup = async () => {
  const closing = browser;
  const owned = server;
  browser = null;
  server = null;
  let failure;
  try {
    await closing?.close();
  } catch (error) {
    failure = error;
  }
  if (owned?.pid) {
    try {
      process.kill(-owned.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') failure ??= error;
    }
  }
  if (failure) throw failure;
};
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(1));
  });
try {
  if (await answering(local)) {
    if (!argv.includes('--reuse-server'))
      throw new Error(
        `${local} is already in use. Verify it serves this checkout, then use --reuse-server, or choose an unused --local port.`,
      );
    console.log(`using the explicitly selected existing server at ${local}`);
  } else {
    const [command, ...args] = serverCommand(config.startCommand, local);
    console.log(`starting the dev server for ${local} ...`);
    server = spawn(command, args, { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    server.stdout.resume();
    server.stderr.resume();
    let failed;
    server.on('error', (error) => {
      failed = error;
    });
    const deadline = Date.now() + 120_000;
    while (!(await answering(local))) {
      if (failed) throw failed;
      if (server.exitCode !== null)
        throw new Error(`Development server exited ${server.exitCode} before becoming ready.`);
      if (Date.now() > deadline) throw new Error('the dev server did not come up in 2 minutes');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch();
  for (const width of widths) {
    for (const [name, origin] of [
      ['before', prod],
      ['after', local],
    ]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      if (!response?.ok()) throw new Error(`${name} page returned HTTP ${response?.status() ?? 'unknown'}`);
      await readyForCapture(page, config.readySelector);
      if (errors.length) throw new Error(`${name} page errors: ${errors.join('; ')}`);
      const base = `${name}-${label(width)}`;
      await page.screenshot({
        path: path.join(out, `${base}.png`),
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
      });
      written.push(`${base}.png`);
      if (focus) {
        const el = page.locator(focus).first();
        if (!(await el.count()) && name === 'after') throw new Error(`Focus target not found: ${focus}`);
        if (await el.count()) {
          await revealFocus(el);
          await readyForCapture(page);
          await el.screenshot({ path: path.join(out, `${base}-focus.png`), animations: 'disabled', caret: 'hide' });
          written.push(`${base}-focus.png`);
        }
      }
      if (name === 'after') {
        for (const [k, spec] of hovers.entries()) {
          const [selector, at = '0.5,0.5'] = spec.split(/@(?=[\d.]+,[\d.]+$)/);
          const el = page.locator(selector).first();
          if (!(await el.count())) throw new Error(`Hover target not found: ${selector}`);
          await revealFocus(el);
          const box = await el.boundingBox();
          if (!box) continue;
          const [fx, fy] = at.split(',').map(Number);
          await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
          await el.screenshot({ path: path.join(out, `${base}-hover-${k + 1}.png`) });
          written.push(`${base}-hover-${k + 1}.png`);
          await page.mouse.move(0, 0);
        }
      }
      if (open && name === 'after') {
        const target = page.locator(open).first();
        if (await target.count()) {
          await openControl(target);
          await readyForCapture(page);
          await page.screenshot({
            path: path.join(out, `${base}-open.png`),
            fullPage: true,
            animations: 'disabled',
            caret: 'hide',
          });
          written.push(`${base}-open.png`);
          await target.locator('xpath=..').screenshot({ path: path.join(out, `${base}-open-panel.png`) });
          written.push(`${base}-open-panel.png`);
        }
      }
      if (errors.length) throw new Error(`${name} page errors: ${errors.join('; ')}`);
      await page.close();
    }
  }
} finally {
  await cleanup();
}

if (!focus && !argv.includes('--full-page')) {
  for (const width of widths) written.push(...(await writeDifferenceCrops(out, label(width))));
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
    if (run('git', ['status', '--porcelain'], scratch))
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
      const pair = (key) =>
        [
          '| Before | After |',
          '|---|---|',
          `| ${has(`before-${key}.png`) ? img(`before-${key}.png`, `before, ${w}`) : '_not on production yet_'} | ${img(`after-${key}.png`, `after, ${w}`)} |`,
        ].join('\n');
      let block = `### ${w[0].toUpperCase()}${w.slice(1)} (${width}px)`;
      if (has(`after-${w}-focus.png`)) block += `\n\n${pair(`${w}-focus`)}`;
      else if (argv.includes('--full-page')) block += `\n\n${pair(w)}`;
      else if (has(`after-${w}-change-1.png`)) {
        for (let k = 1; has(`after-${w}-change-${k}.png`); k++)
          block += `\n\nChange ${k}:\n\n${pair(`${w}-change-${k}`)}`;
      } else block += '\n\nNo visual differences detected above the pixel tolerance.';
      for (let k = 1; has(`after-${w}-hover-${k}.png`); k++) {
        block += `\n\nHovering:\n\n${img(`after-${w}-hover-${k}.png`, `hover ${k}, ${w}`)}`;
      }
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
