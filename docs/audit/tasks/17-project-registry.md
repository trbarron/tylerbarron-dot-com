# 17 — One registry for projects

|            |              |
| ---------- | ------------ |
| Finding    | A2           |
| Needs      | Repo only    |
| Risk       | Medium. Touches routing, the sitemap and the homepage. No visible change is intended. |
| Size       | 1 day        |
| Depends on | Nothing      |

## Why

Adding a project route today means editing, by hand and in step:

- `app/routes.ts` (the route, and usually its API routes),
- `STATIC_PATHS` in `app/routes/sitemap[.]xml.ts`,
- `staticLinks` and `CATEGORY_BY_KEY` in `app/routes/_index.tsx`,
- `app/utils/projectCards.json` (the share card),
- `commitlint.config.js` (the commit scope),
- and about twenty legacy-redirect entries in `app/routes.ts` cover old URL spellings.

`CLAUDE.md` documents the list because it is easy to miss one. Missing the sitemap or the homepage is silent.

## The change

Create `app/projects.ts` exporting one array. Each entry describes a project page:

```ts
export interface Project {
  /** URL path, e.g. '/chesser-guesser'. */
  path: string;
  /** Route module, relative to app/, e.g. 'routes/chesserGuesser.tsx'. */
  file: string;
  title: string;
  description: string;
  category: 'chess' | 'puzzles' | 'games' | 'vision' | 'gadgets';
  /** Shown on the homepage. */
  listed: boolean;
  /** In the sitemap. */
  indexable: boolean;
  /** Commit scope in commitlint.config.js. */
  scope: string;
}
```

Derive from it:

- the page routes in `app/routes.ts` (API routes and game sub-routes stay hand-written),
- `STATIC_PATHS` in the sitemap,
- `staticLinks` and `CATEGORY_BY_KEY` on the homepage.

Do not fold `projectCards.json` in: `scripts/generate-og-image.py` and `scripts/check-og-images.mjs` read it, and it is Python-readable JSON on purpose. Instead add a test that every `listed` project with a card in that file uses a `path` that exists in the registry.

Leave `commitlint.config.js` as the place scopes are defined (its header comment says so), and add a test that every registry `scope` is one of its `PROJECTS` keys.

### Things to preserve exactly

- **Homepage order and wording.** Copy titles and descriptions character for character from `staticLinks`. Compare the rendered homepage HTML before and after; it must be identical.
- **Sitemap contents.** `/runescape-rascals` is deliberately unlisted and not in the sitemap. `/SSBM` is upper-case. `/set` relies on case-insensitive matching for `/Set`. Compare `/sitemap.xml` before and after; identical.
- **`routes.ts` order.** The catch-all `route('*', …)` must stay last. React Router's config is an ordinary array, so mapping over the registry is fine.
- **Project posts** (blog posts with `type: project`) are merged into the homepage list at render time; that logic stays.

### Legacy redirects

The twenty entries in `routes.ts` all point at `routes/legacyRedirect.ts`, which already computes the target from a map (`SEGMENT_MAP`). The catch-all route `routes/$.tsx` already calls `legacyRedirectPath` for `.html` URLs. Extend the catch-all to try `legacyRedirectPath` for any unmatched path, and delete the twenty entries. `tests/utils/legacyRedirect.test.ts` covers the function; add cases for each removed entry so none is lost, including the query-string case (`/maia-drills?deck=x`).

Watch for loops: the comment in `$.tsx` says only `.html` paths are redirected because "redirecting any other miss could loop back onto this route". `legacyRedirectPath` returns `null` for unknown first segments, and a known segment maps to a real route, so it cannot loop; add a test that the redirect target of every mapped segment is a path in the registry.

## Verify

- `npm run lint && npm run typecheck && npm run format:check && npm test && npm run build`.
- Before/after comparison of `/`, `/sitemap.xml` and `/feed.xml` from the built server (byte-identical apart from asset hashes).
- Every legacy URL in the old `routes.ts` still returns a 301 to the same target: request each against `npm run dev`.
- Update `CLAUDE.md` (and `AGENT.md`, `AGENTS.md`): the "New project route" bullet becomes "add an entry to `app/projects.ts`, a card in `projectCards.json`, and a scope in `commitlint.config.js`".

Commit as `refactor: …` (no release). One PR.

## Done when

Adding a project is one registry entry plus its route file, card and scope, and tests fail if the sitemap, homepage or scope list falls out of step.
