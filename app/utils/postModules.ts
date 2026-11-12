import type { ComponentType } from 'react';

/**
 * The post bodies: one lazily imported module per post, so each is its own
 * chunk on the server and in the browser. Shared by the server (which loads a
 * post before rendering it) and the client (which loads it before navigating
 * to it, or while hydrating it).
 */

interface PostModule {
  default: ComponentType;
}

const MODULES = import.meta.glob<PostModule>('../../posts/*.mdx');
const loading = new Map<string, Promise<PostModule>>();

/** The import for a post, started once and reused; `null` if there is no such post. */
export function loadPost(slug: string): Promise<PostModule> | null {
  const importer = MODULES[`../../posts/${slug}.mdx`];
  if (!importer) return null;
  let promise = loading.get(slug);
  if (!promise) {
    promise = importer();
    // A failed chunk download shouldn't be remembered: the next try may work.
    promise.catch(() => loading.delete(slug));
    loading.set(slug, promise);
  }
  return promise;
}
