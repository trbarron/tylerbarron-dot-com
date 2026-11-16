import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { pinnedSpecs } from '../../scripts/install-lambda-deps.mjs';

const lock = { packages: { 'node_modules/react': { version: '19.2.7' }, 'node_modules/@a/b': { version: '1.0.1' } } };

describe('pinnedSpecs', () => {
  it("pins each Lambda dependency to the root lockfile's version, whatever range it lists", () => {
    expect(pinnedSpecs({ dependencies: { react: '^19.0.0', '@a/b': '^1.0.0' } }, lock)).toEqual([
      '@a/b@1.0.1',
      'react@19.2.7',
    ]);
  });

  it('refuses a package the root lockfile does not have', () => {
    expect(() => pinnedSpecs({ dependencies: { leftpad: '^1.0.0' } }, lock)).toThrow(/leftpad/);
  });

  it('resolves every package the real Lambda lists', () => {
    const read = (f: string) => JSON.parse(fs.readFileSync(f, 'utf8'));
    const specs = pinnedSpecs(read('server/package.json'), read('package-lock.json'));
    expect(specs.length).toBe(Object.keys(read('server/package.json').dependencies).length);
  });
});
