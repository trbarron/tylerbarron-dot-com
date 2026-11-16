import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PROJECT_CATEGORIES, PROJECTS, PROJECT_PATHS } from '~/utils/projects';

const postsDir = path.resolve(__dirname, '../../posts');

/** `title` and `type` from each post's frontmatter. */
function projectPosts() {
  return fs
    .readdirSync(postsDir)
    .filter((f) => f.endsWith('.mdx'))
    .flatMap((file) => {
      const front = fs.readFileSync(path.join(postsDir, file), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      const field = (name: string) =>
        front
          .match(new RegExp(`^${name}:\\s*(.*)$`, 'm'))?.[1]
          .trim()
          .replace(/^["']|["']$/g, '');
      return field('type') === 'project' ? [{ slug: file.replace(/\.mdx$/, ''), title: field('title') }] : [];
    });
}

describe('projects', () => {
  it('lists every project post under its own title', () => {
    for (const post of projectPosts()) {
      const entry = PROJECTS.find((p) => p.url === `/blog/${post.slug}`);
      expect(entry, post.slug).toBeDefined();
      expect(entry?.title).toBe(post.title);
    }
  });

  it('has unique urls and known categories', () => {
    const urls = PROJECTS.map((p) => p.url);
    expect(new Set(urls).size).toBe(urls.length);
    const ids = new Set(PROJECT_CATEGORIES.map((c) => c.id));
    for (const p of PROJECTS) expect(ids.has(p.category), p.title).toBe(true);
  });

  it('gives the sitemap only on-site project pages', () => {
    expect(PROJECT_PATHS).toContain('/chesser-guesser');
    expect(PROJECT_PATHS.some((p) => p.startsWith('/blog/') || p.startsWith('http'))).toBe(false);
  });
});
