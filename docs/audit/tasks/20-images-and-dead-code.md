# 20 — Lazy images, modern formats, and unused image helpers

|            |              |
| ---------- | ------------ |
| Finding    | P4           |
| Needs      | Repo only    |
| Risk       | Low          |
| Size       | Half a day   |
| Depends on | 13 if both are planned (13 deletes the unused helpers) |

## Why

The repo holds about 118 images: 68 PNG, 47 JPEG, 2 WebP. None is alarming (the largest is 500 kB), but blog posts load every image up front, and the count grows with each post.

## The change

**1. Lazy-load images in posts.** Posts are compiled by `scripts/lib/vite-posts.mjs`. `rehype-img-size` already sets `width` and `height`, so lazy loading causes no layout shift. Add a small rehype plugin in that file, after `rehypeImgSize`, that sets `loading="lazy"` and `decoding="async"` on every `img` element.

- The first image of a post is usually above the fold. Skip the first `img` in each document so it loads eagerly.
- Add a unit test next to `tests/scripts/vitePosts.test.ts` that runs the plugin over a small tree.

**2. Hand-written pages.** `grep -rn "<img" app` lists the rest. Add `loading="lazy" decoding="async"` to images that are clearly below the fold (galleries on `/SSBM`, `/set`, `/the-riddler`, `/generative-art`, `/camel-up-cup/2018`). Leave hero images and anything in the first screen alone.

**3. Modern formats (optional, discuss first).** Converting PNG screenshots to WebP typically halves them. `sharp` is already a devDependency. Options: a script that writes `.webp` next to each source and a rehype step that emits `<picture>`; or convert in place and update references. The second is simpler but changes filenames, and `/images/*` files are cached as immutable (see task 13). Propose an approach to the owner before doing it.

**4. Unused helpers.** `app/utils/cdn.ts` exports `getResponsiveSrcSet`, `getModernImageSources`, `preloadImage` and `image()`. None has a caller, and the first two build URLs for size variants that are never generated. Delete them (skip if task 13 already did). Keep `getImageUrl`.

## Verify

- `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build`.
- The rendered HTML of a post with several images (for example `/blog/planomancer`) has `loading="lazy"` on all but the first.
- This changes what pages do while loading, not what they look like; scroll one long post in a browser with the network tab open and confirm images load as they approach the viewport.

Commits: `perf(blog): …`, `perf(site): …`, `refactor: …` for the dead code.

## Done when

Post images below the first are lazy, and `cdn.ts` exports only what is used.
