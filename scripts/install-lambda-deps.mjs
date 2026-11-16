#!/usr/bin/env node
/**
 * Install the Lambda's dependencies (server/node_modules) at the versions the
 * root lockfile pins.
 *
 * server/package.json says WHICH packages ship in the Lambda; it has no
 * lockfile, and its ranges used to be resolved fresh on every deploy, so the
 * Lambda could run a react-router or react-dom other than the one the build
 * compiled against and the tests ran against. This installs each listed
 * package at exactly the version in package-lock.json instead. The packages
 * those depend on still resolve from their ranges.
 *
 *   node scripts/install-lambda-deps.mjs            install
 *   node scripts/install-lambda-deps.mjs --print    just print the pinned specs
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const serverDir = path.join(root, 'server');

/** `name@version` for every dependency in server/package.json, from the root lockfile. */
export function pinnedSpecs(serverPkg, rootLock) {
  return Object.keys(serverPkg.dependencies ?? {})
    .sort()
    .map((name) => {
      const version = rootLock.packages?.[`node_modules/${name}`]?.version;
      if (!version) {
        throw new Error(
          `${name} is in server/package.json but not in the root package-lock.json. ` +
            'Add it to the root package.json too, so the build and the Lambda use one version.',
        );
      }
      return `${name}@${version}`;
    });
}

function main() {
  const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
  const specs = pinnedSpecs(read(path.join(serverDir, 'package.json')), read(path.join(root, 'package-lock.json')));
  if (process.argv.includes('--print')) {
    console.log(specs.join('\n'));
    return;
  }
  console.log(`Installing Lambda deps at the root lockfile's versions:\n  ${specs.join('\n  ')}`);
  // --no-save: server/package.json stays the hand-kept list of names.
  execFileSync(
    'npm',
    ['install', '--omit=dev', '--no-audit', '--no-fund', '--no-save', '--no-package-lock', ...specs],
    { cwd: serverDir, stdio: 'inherit' },
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
