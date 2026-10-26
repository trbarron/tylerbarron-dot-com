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
 * repo: `gh` cannot upload images, so drag them into the PR description on GitHub.
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
 *   --env-file   a .env to borrow variables from for the dev server (only --env-keys)
 *   --env-keys   comma list of variables to take from it (default REDIS_URL,REDIS_TLS_URL)
 *
 * A page that reads live data shows live data: run it while the data is worth showing.
 */

import { spawn, execSync } from 'node:child_process';
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
