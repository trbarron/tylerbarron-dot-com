#!/usr/bin/env node
/**
 * CI guard: every package the Lambda imports is installed in the Lambda.
 *
 * The SSR build externalizes npm deps (bare `from "pkg"` imports), and the
 * Lambda installs only server/package.json, a hand-maintained list. When they
 * disagree, routes whose chunks import the missing package 500 for bots and
 * curl, while browsers recover client-side, so a browser test looks fine
 * (this shipped once, 2026-06-10). See the verify-lambda-deps skill.
 *
 * Run after the Lambda is assembled the way deploy does it:
 *   npm run compile:mdx && npm run build && npm run build:arc:server && npm run build:arc:deps
 * then this resolves every bare import in server/index.mjs and server/build/server
 * against server/node_modules, the tree the Lambda actually ships (transitive
 * deps included).
 *
 * Dependency-free on purpose.
 */

import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';

const root = path.resolve(import.meta.dirname, '..');
const serverDir = path.join(root, 'server');
const modulesDir = path.join(serverDir, 'node_modules');

/** Provided by the Lambda's Node runtime (AWS SDK v3), so never installed. */
const RUNTIME_PROVIDED = [/^@aws-sdk\//];

/**
 * Dynamic imports that are never evaluated on the server. Each needs a reason;
 * a static import of these would still fail.
 */
const CLIENT_ONLY = {
  '@google/model-viewer': 'imported in a useEffect in TrophyModel.tsx; must never reach SSR',
  'yet-another-react-lightbox': 'React.lazy in LazyLightbox.tsx, rendered only once a photo is clicked',
};

const builtins = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));
const npmName = /^(?:@[a-z0-9-][a-z0-9-._]*\/)?[a-z0-9][a-z0-9-._]*$/;

/** `react-dom/server` → `react-dom`; `@scope/pkg/sub` → `@scope/pkg`. */
function packageOf(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function files(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return files(full);
    return /\.(m?js)$/.test(e.name) ? [full] : [];
  });
}

const bundle = [path.join(serverDir, 'index.mjs'), ...files(path.join(serverDir, 'build', 'server'))];
if (!fs.existsSync(bundle[0]) || !fs.existsSync(modulesDir)) {
  console.error(
    '✗ No assembled Lambda in server/. Build it first:\n' +
      '  npm run compile:mdx && npm run build && npm run build:arc:server && npm run build:arc:deps',
  );
  process.exit(1);
}

// specifier → { files, dynamicOnly }
const found = new Map();
for (const file of bundle) {
  const source = fs.readFileSync(file, 'utf8');
  const record = (spec, dynamic) => {
    // Relative paths, and `~/…` (the app's path alias, which only survives in comments).
    if (/^[./~]/.test(spec)) return;
    const entry = found.get(spec) ?? { files: new Set(), dynamicOnly: true };
    entry.files.add(path.relative(root, file));
    if (!dynamic) entry.dynamicOnly = false;
    found.set(spec, entry);
  };
  // Static: `import x from "p"`, `import"p"`, `export * from "p"` (minified or not).
  for (const m of source.matchAll(/\b(?:from|import)\s*["']([^"'\s]+)["']/g)) record(m[1], false);
  // Dynamic: `import("p")`.
  for (const m of source.matchAll(/\bimport\s*\(\s*["']([^"'\s]+)["']\s*\)/g)) record(m[1], true);
}

const failures = [];
const checked = [];
for (const [spec, { files: where, dynamicOnly }] of [...found].sort()) {
  if (builtins.has(spec) || builtins.has(spec.split('/')[0])) continue;
  // Prose in compiled MDX can look like an import; real package names are lowercase npm names.
  const pkg = packageOf(spec);
  if (!npmName.test(pkg)) continue;
  if (RUNTIME_PROVIDED.some((r) => r.test(pkg))) continue;
  if (fs.existsSync(path.join(modulesDir, pkg, 'package.json'))) {
    checked.push(pkg);
    continue;
  }
  if (dynamicOnly && CLIENT_ONLY[pkg]) continue;
  failures.push(`  ${spec}  (${dynamicOnly ? 'dynamic import' : 'import'} in ${[...where].join(', ')})`);
}

if (failures.length) {
  console.error('✗ The Lambda imports packages it does not install:\n');
  for (const f of failures) console.error(f);
  console.error(
    '\nAdd each to server/package.json (small, needed at runtime) or to ssr.noExternal in vite.config.ts' +
      ' (large or tree-shakeable, so it gets bundled). A dynamic import that never runs on the server' +
      ' can go in CLIENT_ONLY in this script, with the reason.',
  );
  process.exit(1);
}
console.log(`✓ Every package the Lambda imports is installed: ${[...new Set(checked)].join(', ')}.`);
