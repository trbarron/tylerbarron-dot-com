/**
 * Server-side blog post listings.
 *
 * Everything here reads `virtual:posts-index`: each post's frontmatter,
 * gathered at build time (scripts/lib/vite-posts.mjs). No post body is loaded
 * to list, link or describe a post; the bodies are separate modules that only
 * the blog route imports, one at a time (app/utils/postModules.ts).
 */

import postsIndex from 'virtual:posts-index';

export type Frontmatter = { title: string; date: string; type?: string; subtitle?: string } & Record<string, unknown>;

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  type?: string;
  subtitle?: string;
  /** `unlisted: true` frontmatter: reachable by URL, but absent from every list. */
  unlisted: boolean;
}

const BY_SLUG = postsIndex as Record<string, Frontmatter>;

function toMeta(slug: string, frontmatter: Frontmatter): PostMeta {
  return {
    slug,
    title: frontmatter.title,
    date: frontmatter.date,
    type: frontmatter.type,
    subtitle: frontmatter.subtitle,
    unlisted: frontmatter.unlisted === true || frontmatter.unlisted === 'true',
  };
}

/** A post's frontmatter by slug, or `null` if there is no such post. */
export async function getPostFrontmatter(slug: string): Promise<Frontmatter | null> {
  return Object.hasOwn(BY_SLUG, slug) ? BY_SLUG[slug] : null;
}

/**
 * List metadata for every post, newest first. Unlisted posts are left out
 * (homepage, feed, sitemap, prev/next) unless `includeUnlisted` is set.
 */
export async function getAllPostMeta({ includeUnlisted = false } = {}): Promise<PostMeta[]> {
  let metas = Object.entries(BY_SLUG).map(([slug, frontmatter]) => toMeta(slug, frontmatter));
  if (!includeUnlisted) metas = metas.filter((m) => !m.unlisted);
  return metas.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
