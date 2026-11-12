import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildPostsIndex, readFrontmatter } from '../../scripts/lib/vite-posts.mjs';

describe('readFrontmatter', () => {
  it('reads the YAML block at the top of a post', () => {
    expect(readFrontmatter('---\ntitle: "Hello"\ntype: project\n---\n# Body')).toEqual({
      title: 'Hello',
      type: 'project',
    });
  });

  it('is empty for a post without one', () => {
    expect(readFrontmatter('# Just a heading')).toEqual({});
  });

  it('reads a bare `no` as false, as the posts were written against', () => {
    expect(readFrontmatter('---\nai: no\ncomments: false\n---\n')).toEqual({ ai: false, comments: false });
  });
});

describe('buildPostsIndex', () => {
  it('indexes frontmatter by slug, with ISO dates and an ogImage only when the card exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'posts-'));
    const posts = path.join(dir, 'posts');
    const og = path.join(dir, 'public', 'images', 'og');
    fs.mkdirSync(posts);
    fs.mkdirSync(og, { recursive: true });
    fs.writeFileSync(path.join(posts, 'a.mdx'), '---\ntitle: A\ndate: 2025-12-31\n---\nbody');
    fs.writeFileSync(path.join(posts, 'b.mdx'), '---\ntitle: B\ndate: 2024-01-02\nunlisted: true\n---\nbody');
    fs.writeFileSync(path.join(posts, 'notes.txt'), 'ignored');
    fs.writeFileSync(path.join(og, 'a.png'), '');

    expect(buildPostsIndex(posts, path.join(dir, 'public'))).toEqual({
      a: { title: 'A', date: '2025-12-31T00:00:00.000Z', ogImage: '/images/og/a.png' },
      b: { title: 'B', date: '2024-01-02T00:00:00.000Z', unlisted: true },
    });
  });

  it('gives every real post a title and a parseable date, and never a body', () => {
    const index = buildPostsIndex();
    const slugs = fs.readdirSync('posts').filter((f) => f.endsWith('.mdx'));
    expect(Object.keys(index)).toHaveLength(slugs.length);
    for (const [slug, frontmatter] of Object.entries(index) as [string, Record<string, unknown>][]) {
      expect(typeof frontmatter.title, slug).toBe('string');
      expect(Number.isNaN(new Date(frontmatter.date as string).getTime()), slug).toBe(false);
    }
    // The whole index stays small: it is what the homepage, feed and sitemap load.
    expect(JSON.stringify(index).length).toBeLessThan(slugs.length * 600);
  });
});
