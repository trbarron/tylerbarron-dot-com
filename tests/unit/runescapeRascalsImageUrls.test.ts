import { describe, expect, it } from 'vitest';
import { portraitUrl, shotUrl } from '~/utils/runescapeRascals/imageUrls';

const bot = { name: 'bram', portraitVersion: 'abc123', shotAt: 99 };

describe('portraitUrl', () => {
  it('points at the versioned bucket object when the publisher uses the bucket', () => {
    expect(portraitUrl(bot, 'head', 3, '/images/rascals-live')).toBe(
      '/images/rascals-live/portraits/bram/head-3-abc123.png',
    );
    expect(portraitUrl(bot, 'body', 0, '/images/rascals-live')).toBe(
      '/images/rascals-live/portraits/bram/body-0-abc123.png',
    );
  });

  it('falls back to the API route without an asset base', () => {
    expect(portraitUrl(bot, 'head', 0)).toBe('/api/runescapeRascals/portrait/bram/head?v=abc123');
    expect(portraitUrl(bot, 'head', 3)).toBe('/api/runescapeRascals/portrait/bram/head?v=abc123&a=3');
  });

  it('does not invent a bucket URL for a character with no published version', () => {
    expect(portraitUrl({ name: 'bram' }, 'head', 0, '/images/rascals-live')).toContain(
      '/api/runescapeRascals/portrait/',
    );
  });
});

describe('shotUrl', () => {
  it('uses the bucket copy with a cache-busting timestamp, or the API route', () => {
    expect(shotUrl(bot, '/images/rascals-live')).toBe('/images/rascals-live/shots/bram.jpg?t=99');
    expect(shotUrl(bot)).toBe('/api/runescapeRascals/shot/bram?t=99');
  });
});
