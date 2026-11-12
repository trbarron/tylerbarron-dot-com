// Blog posts: compiled by @mdx-js/rollup (scripts/lib/vite-posts.mjs).
declare module '*.mdx' {
  import type { ComponentType } from 'react';
  const Post: ComponentType;
  export default Post;
}

/** slug → frontmatter for every post; no post bodies. */
declare module 'virtual:posts-index' {
  const index: Record<string, Record<string, unknown>>;
  export default index;
}

// Injected at build time by vite.config.ts `define`.
declare const __APP_VERSION__: string;
declare const __GIT_COMMIT__: string;
