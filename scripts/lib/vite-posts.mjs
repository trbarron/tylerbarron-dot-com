/**
 * How blog posts get into the build.
 *
 * posts/*.mdx are ordinary modules: @mdx-js/rollup compiles each one to a
 * component, so a post is its own chunk on the server and in the browser, and
 * is imported like any other code (no string of JavaScript to evaluate).
 *
 * Listings (homepage, feed, sitemap, prev/next) must not import twenty post
 * bodies to read twenty titles, so `virtual:posts-index` holds every post's
 * frontmatter and nothing else. Dev and production share this one path.
 */

import fs from 'node:fs';
import path from 'node:path';
import mdx from '@mdx-js/rollup';
import rehypeImgSize from 'rehype-img-size';
import rehypeKatex from 'rehype-katex';
import rehypePrettyCode from 'rehype-pretty-code';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { parse as parseYaml } from 'yaml';

const root = path.resolve(import.meta.dirname, '..', '..');
const postsDir = path.join(root, 'posts');

const VIRTUAL_ID = 'virtual:posts-index';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

/** The MDX compiler, with the plugins every post is written against. */
export function mdxPosts() {
  return {
    enforce: 'pre',
    ...mdx({
      // remarkFrontmatter only keeps the YAML block out of the rendered post;
      // its values reach the app through the index below.
      remarkPlugins: [remarkFrontmatter, remarkMath, remarkGfm],
      rehypePlugins: [
        rehypeKatex,
        // Shiki highlighting at compile time; keepBackground off so the
        // prose-pre styles control the block background. Untagged fences
        // (ASCII diagrams) are left untouched.
        [rehypePrettyCode, { theme: 'github-light', keepBackground: false }],
        // width/height on every <img>, read from public/, so images don't shift the page.
        [rehypeImgSize, { dir: 'public' }],
      ],
    }),
  };
}

/** The YAML between the leading `---` lines of a post. */
export function readFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  // YAML 1.1, like the parser the posts were written against: a bare `no` is false.
  return match ? (parseYaml(match[1], { version: '1.1' }) ?? {}) : {};
}

/** slug → frontmatter for every post, plus `ogImage` when its share card exists. */
export function buildPostsIndex(dir = postsDir, publicDir = path.join(root, 'public')) {
  const index = {};
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.mdx')) continue;
    const slug = file.slice(0, -'.mdx'.length);
    const frontmatter = readFrontmatter(fs.readFileSync(path.join(dir, file), 'utf8'));
    // Dates come out of YAML as Date objects; the app wants the ISO string JSON would give it.
    for (const [key, value] of Object.entries(frontmatter)) {
      if (value instanceof Date) frontmatter[key] = value.toISOString();
    }
    // Per-post OG share card (scripts/generate-og-image.py). Only referenced
    // when the PNG exists, so meta never points at a 404.
    if (fs.existsSync(path.join(publicDir, 'images', 'og', `${slug}.png`))) {
      frontmatter.ogImage = `/images/og/${slug}.png`;
    }
    index[slug] = frontmatter;
  }
  return index;
}

/** Serves `virtual:posts-index`, and rebuilds it in dev when a post changes. */
export function postsIndex() {
  return {
    name: 'posts-index',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
    },
    load(id) {
      if (id !== RESOLVED_ID) return;
      for (const file of fs.readdirSync(postsDir)) {
        if (file.endsWith('.mdx')) this.addWatchFile(path.join(postsDir, file));
      }
      return `export default ${JSON.stringify(buildPostsIndex())};`;
    },
    configureServer(server) {
      const refresh = (file) => {
        if (!file.startsWith(postsDir + path.sep) || !file.endsWith('.mdx')) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
      };
      server.watcher.on('add', refresh).on('unlink', refresh).on('change', refresh);
    },
  };
}
