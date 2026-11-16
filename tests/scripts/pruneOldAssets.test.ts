import { describe, it, expect } from 'vitest';
import { prunable } from '../../scripts/prune-old-assets.mjs';

const DAY = 24 * 60 * 60 * 1000;
const now = Date.parse('2026-11-12T00:00:00Z');
const at = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

describe('prunable assets', () => {
  it('removes only files that are both old and absent from the current build', () => {
    const objects = [
      { Key: 'assets/old-gone.js', LastModified: at(45) },
      { Key: 'assets/old-still-used.js', LastModified: at(400) },
      { Key: 'assets/recent-gone.js', LastModified: at(3) },
      { Key: 'assets/current.js', LastModified: at(0) },
    ];
    const current = new Set(['assets/old-still-used.js', 'assets/current.js']);
    expect(prunable(objects, current, now)).toEqual(['assets/old-gone.js']);
  });

  it('never returns a key outside assets/', () => {
    const objects = [{ Key: 'images/posts/a.png', LastModified: at(999) }];
    expect(prunable(objects, new Set(), now)).toEqual([]);
  });
});
