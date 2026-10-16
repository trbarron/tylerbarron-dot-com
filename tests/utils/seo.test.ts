/**
 * Share-card selection in buildMeta: a page's generated project card when it
 * has one, the brand card otherwise, and an explicit image over both.
 */

import { describe, it, expect } from 'vitest';
import { buildMeta } from '~/utils/seo';
import projectCards from '~/utils/projectCards.json';

const prop = (meta: ReturnType<typeof buildMeta>, name: string) => {
  const tag = meta.find((m) => 'property' in m && m.property === name);
  return tag && 'content' in tag ? tag.content : undefined;
};

describe('buildMeta share card', () => {
  it('uses the project card for a page that has one, with its size', () => {
    const meta = buildMeta({ title: 'Marginal Maia Mentor', path: '/marginal-maia-mentor' });
    expect(prop(meta, 'og:image')).toBe('https://tylerbarron.com/images/og/projects/marginal-maia-mentor.png');
    expect(prop(meta, 'og:image:width')).toBe('1200');
    expect(prop(meta, 'og:image:height')).toBe('630');
  });

  it('falls back to the brand card for a page without one', () => {
    const meta = buildMeta({ title: 'Set', path: '/set' });
    expect(prop(meta, 'og:image')).toBe('https://tylerbarron.com/images/og-default.png');
    expect(prop(meta, 'og:image:width')).toBe('1200');
  });

  it('prefers an explicit image and leaves its size unstated', () => {
    const meta = buildMeta({ path: '/marginal-maia-mentor', image: '/images/og/post.png' });
    expect(prop(meta, 'og:image')).toBe('https://tylerbarron.com/images/og/post.png');
    expect(prop(meta, 'og:image:width')).toBeUndefined();
  });

  it('gives every card a site path', () => {
    for (const card of Object.values(projectCards)) expect(card.path).toMatch(/^\/[^/]/);
  });
});
