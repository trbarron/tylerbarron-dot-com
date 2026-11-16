import { describe, expect, it } from 'vitest';
import { portraitUrl, shotUrl } from '~/utils/runescapeRascals/imageUrls';

const bot = { name: 'bram', portraitVersion: 'abc123', shotAt: 99 };
const base = '/images/rascals-live';

describe('image urls', () => {
  it('points a portrait at the versioned bucket object for its view', () => {
    expect(portraitUrl(bot, 'head', 3, base)).toBe('/images/rascals-live/portraits/bram/head-3-abc123.png');
    expect(portraitUrl(bot, 'body', 0, base)).toBe('/images/rascals-live/portraits/bram/body-0-abc123.png');
  });

  it('points a screenshot at the bucket copy with a cache-busting timestamp', () => {
    expect(shotUrl(bot, base)).toBe('/images/rascals-live/shots/bram.jpg?t=99');
  });
});
