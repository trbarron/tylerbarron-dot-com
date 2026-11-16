# 20 — Lazy-load below-the-fold images

|            |              |
| ---------- | ------------ |
| Finding    | P4           |
| Needs      | Repo only    |
| Risk       | Low          |
| Size       | Small change |
| Depends on | Nothing      |

## Why

The repo holds about 118 images: 68 PNG, 47 JPEG, 2 WebP. None is alarming (the largest is 500 kB), but blog posts load every image up front, and the count grows with each post.

## The change

**1. Lazy-load images in posts.** Posts are compiled by `scripts/lib/vite-posts.mjs`. `rehype-img-size` already sets `width` and `height`, so lazy loading causes no layout shift. Add a small rehype plugin in that file, after `rehypeImgSize`, that sets `loading="lazy"` and `decoding="async"` on every `img` element.

- The first image of a post is usually above the fold. Skip the first `img` in each document so it loads eagerly.
- Add a unit test next to `tests/scripts/vitePosts.test.ts` that runs the plugin over a small tree.

**2. Hand-written pages.** `grep -rn "<img" app` lists the rest. Add `loading="lazy" decoding="async"` to images that are clearly below the fold (galleries on `/SSBM`, `/set`, `/the-riddler`, `/generative-art`, `/camel-up-cup/2018`). Leave hero images and anything in the first screen alone.

Do not add format conversion, responsive variants or a new image pipeline. Unused image helpers can be removed during task 13; they do not need a separate cleanup project.

## Verify

- `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build`.
- The rendered HTML of a post with several images (for example `/blog/planomancer`) has `loading="lazy"` on all but the first.
- This changes what pages do while loading, not what they look like; scroll one long post in a browser with the network tab open and confirm images load as they approach the viewport.

Commits: `perf(blog): …`, `perf(site): …`, `refactor: …` for the dead code.

## Done when

Below-the-fold images load lazily, while first-screen images remain eager.
