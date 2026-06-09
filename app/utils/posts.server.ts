/**
 * Server-side blog post access.
 *
 * Production: posts are compiled to JSON at build time (`npm run compile:mdx`)
 * into `app/posts/compiled/` and bundled into the SSR build via `import.meta.glob`.
 * No S3 round-trip, no `@aws-sdk/client-s3` at runtime. Image `src`s inside the
 * compiled code are already rewritten to the CDN by the compile step.
 *
 * Development: posts are compiled on the fly from `posts/*.mdx` for instant
 * editing feedback. `import.meta.env.DEV` is a compile-time constant, so this
 * branch (and `mdx-bundler`) is dead-code-eliminated from the production build.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Frontmatter = { title: string; date: string; type?: string; subtitle?: string } & Record<string, any>;

export interface CompiledPost {
  code: string;
  frontmatter: Frontmatter;
}

export interface PostMeta {
  slug: string;
  title: string;
  date: string;
  type?: string;
  subtitle?: string;
}

// Eagerly bundle every pre-compiled post. Empty in dev (dir may not exist),
// which is fine because the DEV branches below never read from it.
const COMPILED = import.meta.glob<CompiledPost>('../posts/compiled/*.json', {
  eager: true,
  import: 'default',
});

const BY_SLUG: Record<string, CompiledPost> = {};
for (const [filePath, post] of Object.entries(COMPILED)) {
  const slug = filePath.split('/').pop()!.replace('.json', '');
  BY_SLUG[slug] = post;
}

function toMeta(slug: string, frontmatter: Frontmatter): PostMeta {
  return {
    slug,
    title: frontmatter.title,
    date: frontmatter.date,
    type: frontmatter.type,
    subtitle: frontmatter.subtitle,
  };
}

/** Load a single compiled post by slug, or `null` if it doesn't exist. */
export async function getPost(slug: string): Promise<CompiledPost | null> {
  if (import.meta.env.DEV) {
    const [{ processMdx }, fs, path] = await Promise.all([
      import('./mdx.server'),
      import('node:fs/promises'),
      import('node:path'),
    ]);
    try {
      const source = await fs.readFile(path.join(process.cwd(), 'posts', `${slug}.mdx`), 'utf-8');
      const { code, frontmatter } = await processMdx(source);
      return { code, frontmatter: frontmatter as Frontmatter };
    } catch {
      return null;
    }
  }
  return BY_SLUG[slug] ?? null;
}

/** List metadata for every post, newest first. */
export async function getAllPostMeta(): Promise<PostMeta[]> {
  let metas: PostMeta[];

  if (import.meta.env.DEV) {
    const [{ processMdx }, fs, path] = await Promise.all([
      import('./mdx.server'),
      import('node:fs/promises'),
      import('node:path'),
    ]);
    const postsDir = path.join(process.cwd(), 'posts');
    const files = (await fs.readdir(postsDir)).filter((f) => f.endsWith('.mdx'));
    metas = await Promise.all(
      files.map(async (filename) => {
        const source = await fs.readFile(path.join(postsDir, filename), 'utf-8');
        const { frontmatter } = await processMdx(source);
        return toMeta(filename.replace('.mdx', ''), frontmatter as Frontmatter);
      }),
    );
  } else {
    metas = Object.entries(BY_SLUG).map(([slug, { frontmatter }]) => toMeta(slug, frontmatter));
  }

  return metas.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
