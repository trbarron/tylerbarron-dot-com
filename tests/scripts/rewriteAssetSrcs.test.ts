/**
 * Regression guard for the MDX -> CDN image rewrite.
 *
 * A CI misconfiguration that left this rewrite disabled (no VITE_CDN_URL)
 * broke every blog image in production: relative `/images/*` paths fell
 * through to the Lambda, which doesn't serve them, and returned HTML.
 * These tests pin the exact rewrite behavior so that can't silently recur.
 */

import { describe, it, expect } from 'vitest';
import { computeCdnBase, rewriteAssetSrcs } from '../../scripts/lib/rewriteAssetSrcs.mjs';

const CDN = 'https://cdn.example.com';

describe('computeCdnBase', () => {
  it('prefers VITE_CDN_URL over CDN_URL', () => {
    expect(computeCdnBase({ VITE_CDN_URL: CDN, CDN_URL: 'https://other' })).toBe(CDN);
  });

  it('falls back to CDN_URL when VITE_CDN_URL is unset', () => {
    expect(computeCdnBase({ CDN_URL: CDN })).toBe(CDN);
  });

  it('returns empty string when neither is set', () => {
    expect(computeCdnBase({})).toBe('');
  });

  it('strips a trailing slash', () => {
    expect(computeCdnBase({ VITE_CDN_URL: `${CDN}/` })).toBe(CDN);
  });

  it('strips a trailing /images segment so callers can append it', () => {
    expect(computeCdnBase({ VITE_CDN_URL: `${CDN}/images` })).toBe(CDN);
  });
});

describe('rewriteAssetSrcs', () => {
  it('rewrites /images/ src to the CDN base', () => {
    const code = 'src:"/images/acpl_timecontrol_analysis_all_combined.jpg"';
    expect(rewriteAssetSrcs(code, CDN)).toBe(
      `src:"${CDN}/images/acpl_timecontrol_analysis_all_combined.jpg"`,
    );
  });

  it('rewrites /fonts/ src to the CDN base', () => {
    const code = 'src:"/fonts/Inter.woff2"';
    expect(rewriteAssetSrcs(code, CDN)).toBe(`src:"${CDN}/fonts/Inter.woff2"`);
  });

  it('rewrites every occurrence', () => {
    const code = 'src:"/images/a.jpg" then src:"/images/b.png"';
    expect(rewriteAssetSrcs(code, CDN)).toBe(
      `src:"${CDN}/images/a.jpg" then src:"${CDN}/images/b.png"`,
    );
  });

  it('leaves the code unchanged when no CDN base is provided', () => {
    const code = 'src:"/images/a.jpg"';
    expect(rewriteAssetSrcs(code, '')).toBe(code);
  });

  it('does not touch already-absolute URLs or unrelated paths', () => {
    const code = 'src:"https://example.com/images/a.jpg" alt:"/images/not-a-src"';
    expect(rewriteAssetSrcs(code, CDN)).toBe(code);
  });
});
