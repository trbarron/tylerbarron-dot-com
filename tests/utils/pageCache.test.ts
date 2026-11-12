/**
 * Which pages CloudFront may cache. A page that reads live data or the query
 * string on the server must not be on the cached list: every visitor would get
 * whichever copy the edge happened to keep.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { PAGE_CACHE_CONTROL } from '~/utils/cache';

const routesDir = path.resolve(__dirname, '../../app/routes');
const source = (file: string) => fs.readFileSync(path.join(routesDir, file), 'utf8');
const cached = fs
  .readdirSync(routesDir)
  .filter((f) => f.endsWith('.tsx') && /cachedPageHeaders as headers/.test(source(f)))
  .sort();

describe('the Maia page', () => {
  // Its document has a looser CSP, so it must always be a full page load
  // (clientLoader), must not loop on first load (loader), and must not reload
  // when ?deck= changes (shouldRevalidate). Losing any one breaks the page.
  it('keeps all three exports that make its Content-Security-Policy work', () => {
    const maia = source('maiaDrills.tsx');
    expect(maia).toMatch(/export function clientLoader/);
    expect(maia).toMatch(/export function loader/);
    expect(maia).toMatch(/export function shouldRevalidate/);
  });
});

describe('cached pages', () => {
  it('are exactly the ones that render the same for everyone', () => {
    expect(cached).toEqual([
      'SSBM.tsx',
      '_index.tsx',
      'blog.$slug.tsx',
      'boulderingTracker.tsx',
      'camelUpCup.2018.tsx',
      'catTracker.blog.tsx',
      'collaborativeCheckmate._index.tsx',
      'generativeArt.tsx',
      'multipleChoiceChess._index.tsx',
      'set.tsx',
      'theRiddler.tsx',
    ]);
  });

  it('never read the request or the query string on the server', () => {
    for (const file of cached) {
      expect(source(file), file).not.toMatch(/useSearchParams|searchParams|request\.url|getRedisClient/);
    }
  });

  it('let browsers revalidate and only the edge keep a copy', () => {
    expect(PAGE_CACHE_CONTROL).toContain('max-age=0');
    expect(PAGE_CACHE_CONTROL).toContain('s-maxage=');
    expect(PAGE_CACHE_CONTROL).not.toContain('immutable');
  });
});
