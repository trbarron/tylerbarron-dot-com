# Site audit — November 2026

Structural, security and performance review of the repo at `5.61.1`, with the goal that the site keeps absorbing new projects and posts without each one costing more than the last.

**How this was checked.** Everything below was read from the code and config in this repo, plus one local production build (`compile:mdx` + `react-router build`) for the bundle numbers and one `npm audit --omit=dev`. Nothing was tested against production. AWS-side configuration (CloudFront behaviors and cache policies, IAM roles, API Gateway settings, the Redis provider) is not in the repo, so items that depend on it are marked **verify**.

## Status

This file is the audit as written, kept for its reasoning. It is **not** the list of what is still open: several findings have been fixed since, and two were wrong. For current status and for the work that remains, see [`README.md`](README.md) and the briefs in [`tasks/`](tasks/).

Where each finding stands:

| Finding | Status | Remaining work |
| --- | --- | --- |
| D1 | Done, except tagging before the build | Task 10 |
| D2 | Done | |
| D3 | Advisory cleared, Dependabot on, dependencies updated | Tasks 22, 23, 28 |
| D4 | Open | Task 09 |
| D5 | Open | Task 26 |
| D6 | Open (unverified) | Task 14 |
| D7, D8 | Open | Task 13 |
| D9 | Open | Task 24 |
| S1 | Mostly done | Task 12 |
| S2 | Code done; CloudFront side open | Task 06 |
| S3 | Done; production not yet confirmed healthy | Task 01 |
| S4 | `create` limited; three writers open | Task 11 |
| S5 | Done | |
| S6 | Eval scoped to Maia; the rest open | Tasks 15, 16 |
| S7 | Site no longer runs bots | Tasks 02, 03, 27 |
| S8 | Open | Task 07 |
| P1 | Code done; CloudFront side open | Tasks 04, 05 |
| P2 | Open | Task 19 |
| P3 | Open | Task 18 |
| P4 | Open | Task 20 |
| A1 | Done | |
| A2 | Open | Task 17 |
| A3 | Open | Task 18 |
| A4 | Open | Task 21 |
| A5 | Open | Task 08 |
| A6 | Open | Task 21 |

Two findings were wrong as written:

- **D1:** an S3 lifecycle rule is the wrong way to prune old assets. An unchanged file keeps its old upload date, so a month without deploys would expire the live site's files. The deploy prunes by age *and* absence from the current build instead.
- **S6.1:** `'unsafe-eval'` cannot be dropped everywhere. Blog posts no longer need it, but onnxruntime-web's WebGPU build (Maia Drills) uses `new Function`, so it is granted on the Maia page only and every other page gets `'wasm-unsafe-eval'`.

## Summary

The newer code is in good shape: Collaborative Checkmate (compare-and-set saves, validated input, a public view of state), Media Profile (edit tokens, body-size limit, rate limits), the pinned and hash-checked server Stockfish, and the CI guards (`lambda-deps`, `og-cards`, design rules) are all patterns worth copying. Most findings are older code that predates those patterns, and a deploy pipeline with a window in which production can break.

Do these first:

| #   | Finding                                                                                    | Area     | Effort |
| --- | ------------------------------------------------------------------------------------------ | -------- | ------ |
| D1  | Deploy deletes the live site's assets before the new Lambda is live, and can be cancelled between the two | Deploy   | Small  |
| S1  | Multiple Choice Chess hands each player's secret id to anyone who asks                     | Security | Small  |
| S2  | Per-IP rate limits can be bypassed with a forged `X-Forwarded-For`                         | Security | Small  |
| S3  | Redis TLS certificate checking is switched off                                             | Security | Small  |
| P1  | HTML pages carry no cache headers, so every page view runs the Lambda                      | Perf     | Medium |
| A1  | Blog posts are shipped as strings and `eval`'d; all posts load together                    | Structure / Security / Perf | Medium |
| D2  | The Lambda's dependencies are unlocked and can differ from what was built and tested       | Deploy   | Small  |

---

## Deploy and infrastructure

### D1. Assets are deleted before the Lambda that needs the new ones is live (high)

`.github/workflows/deploy.yml` runs `aws s3 sync build/client/assets/ … --delete` and only then `arc deploy`. From the sync until the deploy finishes, the Lambda in production still renders HTML that points at the previous build's hashed files, which have just been deleted. Anyone with a tab already open hits the same thing later, when a client-side navigation asks for a route chunk that no longer exists. CloudFront's edge cache hides this for popular files at busy edges and nowhere else.

Two things make it worse:

- `concurrency.cancel-in-progress: true` applies to `master` too. A second push while a deploy is running cancels it, possibly after the delete and before `arc deploy`, and the site stays broken until the next run completes.
- semantic-release tags and pushes the release commit before the build. A build failure after that leaves a tagged version that never deployed (the same class of problem the 2026-06-10 note in `docs/deployment.md` describes).

Suggested changes:

1. Drop `--delete` from the `assets/` sync. Hashed files never collide, so old and new builds coexist. Prune with an S3 lifecycle rule on `assets/` (expire after ~30 days), or a sync step that deletes only files older than that.
2. Set `cancel-in-progress: ${{ github.ref != 'refs/heads/master' }}` so PR runs still cancel but a deploy always finishes.
3. Build and run the `lambda-deps` check before semantic-release, so the tag is only pushed for a build that exists. The version bump can be applied to the built artifacts by running `semantic-release --dry-run` first, or by moving the footer version to a runtime env var.

This is also a precondition for caching HTML (P1): cached pages reference old hashes by design.

### D2. The Lambda installs unlocked dependencies (medium)

`server/package.json` has caret ranges and no lockfile (`/server/*` is gitignored), and `build:arc:deps` runs `npm install`. Each deploy resolves whatever is newest that day. The floors also differ from the root (`react-router ^7.0.1` vs `^7.17.0`), so the Lambda can run a `react-router` or `react-dom` version other than the one the build compiled against and the tests ran against. `check:lambda-deps` verifies presence, not version.

Suggested: generate `server/package.json` from the root lockfile's resolved versions at build time (a ~20-line script: for each name in the server list, write the exact version from `package-lock.json`), or commit `server/package-lock.json` and use `npm ci`. The first option also removes the "two lists that must stay in sync" problem for versions, leaving only the list of names.

### D3. Dependency updates and the open advisory (medium)

- `.github/dependabot.yml` covers `github-actions` only. Add the `npm` ecosystem for `/` (and `/server` if it keeps its own manifest), grouped weekly to keep noise down.
- `npm audit --omit=dev` reports one high-severity advisory against the installed `react-router` 7.18.1 (GHSA-qwww-vcr4-c8h2, described as an RSC-mode CSRF bypass). This site does not use RSC mode, so it is probably not exploitable here, but `npm audit fix` resolves it and there is no reason to carry it.
- The build prints five React Router v8 future-flag warnings (`v8_middleware`, `v8_splitRouteModules`, `v8_viteEnvironmentApi`, `v8_passThroughRequests`, `v8_trailingSlashAwareDataRequests`). Opting in one at a time now is cheaper than doing all five during the v8 upgrade. `v8_splitRouteModules` and `v8_middleware` are also useful on their own (see P1 and A4).

### D4. CI credentials and permissions (medium)

- Deploy uses long-lived `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` repository secrets. Switch to GitHub OIDC (`aws-actions/configure-aws-credentials` with a role restricted to this repo and `refs/heads/master`). Nothing long-lived is left to leak or rotate.
- The deploy job grants `issues: write` and `pull-requests: write`. Those were for `@semantic-release/github`, which is no longer used; `contents: write` is enough.
- Put the deploy job in a GitHub `environment` (e.g. `production`) and scope the AWS role's trust to it. That also gives a place for a manual approval gate if one is ever wanted.
- **Verify** the deploy role's policy. Architect needs CloudFormation, Lambda, API Gateway, S3 and IAM pass-role; it does not need account-wide admin.

### D5. Infrastructure that exists only in the console (medium)

The CloudFront distribution, its behaviors and cache policies, the asset bucket policy, the Lambda's permission to invoke `camel-up-tournament`, and the tournament Lambda itself are not described anywhere in this repo. `docs/deployment.md` records the distribution id and behaviors in prose, which is the only reason they are recoverable.

Suggested: a small CloudFormation or CDK stack (or Architect `@cloudformation` macro) for the distribution, behaviors, cache/origin-request policies and response-headers policy. Several items below (P1, S2, S6) are changes to exactly these resources and would otherwise be undocumented console edits.

### D6. Likely duplicate upload of 18 MB of images on every deploy (low, verify)

`build:arc:assets` copies `build/client/*` (20 MB, of which 18 MB is `public/images`) into `public/`, and `app.arc` declares `@static folder public` with `fingerprint true`. So `arc deploy` fingerprints and uploads the whole image tree to Architect's static bucket, after the workflow has already synced the same files to the CDN bucket. If those are different buckets, the Architect copy serves nothing. **Verify** which bucket CloudFront's origin is; if it is not Architect's, remove `@static` (or point it at an empty folder) and delete the `build:arc:assets` step.

### D7. `app/images/` is deployed by hand (medium)

CI syncs `public/images/` only. The 3.9 MB under `app/images/<Project>/` reach S3 through `npm run deploy:images` (`scripts/upload-images-to-s3.mjs`), run manually, with `immutable` one-year caching on fixed filenames. A new project image that is committed but not uploaded works in dev and 404s in production, and nothing in CI notices.

Suggested: move `app/images/*` under `public/images/` (the URLs `getImageUrl()` produces don't change) so there is one image tree and one sync, then delete the upload script and `@aws-sdk/client-s3`. Alternatively import them from components so Vite hashes them into `/assets/`, which also fixes the "immutable but replaceable" mismatch below.

### D8. Unhashed files cached as immutable (low)

Everything under `/images/*` except the four excluded folders is uploaded `max-age=31536000, immutable` under its original filename. Replacing a post image in place will not propagate to anyone who has seen it. The exclusion list in the workflow has grown to four entries for this reason. Either make "new content means a new filename" a CI check, or flip the default: `max-age=86400` for `/images/*` and immutable only for `/assets/*`.

### D9. Cheap Lambda setting (low)

`app.arc` sets `architecture x86_64`. Nothing in `server/package.json` has native code and the server Stockfish is WASM, so `arm64` should work unchanged and is billed about 20% lower per GB-second. Worth trying on its own deploy so it is easy to revert.

---

## Security

Context that sets the severity: the site has no accounts, no cookies and no sessions. There is no credential to steal, so XSS and CSRF have a low ceiling. The realistic risks are cheating and griefing in the games, filling Redis, running up the AWS bill, and the one place the site executes strangers' code (Camel Up Cup).

### S1. Multiple Choice Chess exposes player secrets (high for that game)

`GET /api/multipleChoiceChess/state?gameId=…` returns the whole stored hash, including `white_id` and `black_id`. Those ids are the only thing `move`, `resign` and `claimWin` check. Open game ids are listed by `/available`. So anyone can read both ids of any game and move or resign for either side; your opponent can resign for you.

Related weaknesses in the same code (`app/routes/api/multipleChoiceChess/*`, `app/utils/multipleChoiceChess/gameState.server.ts`):

- The player id is also in the page URL (`/multiple-choice-chess/:gameId/:playerId`), and `root.tsx` sends `window.location.href` to Google Analytics on every navigation.
- Ids come from `Date.now()` plus six characters of `Math.random()`.
- `move` trusts the client's `rank`, which is what the score is computed from, and never checks that `move` is one of `choices`. A client can claim the top-ranked move every turn.
- Every write is read-modify-write with no guard. Two joins race for black; a double-submitted move can apply twice.
- `move`, `resign` and `claimWin` look the game up by `gameId.toLowerCase().trim()` but write with the raw `gameId`, so a mixed-case id writes a stray key.
- `create` has no rate limit (see S4).

Suggested: port this game to the Collaborative Checkmate shape rather than patching each point. Concretely: a `publicView()` that omits ids and returns only "which colour are you"; ids from `crypto.randomUUID()`; the CAS Lua script from `collaborativeCheckmate/game.server.ts` (worth lifting into `app/utils/multiplayer/`); a `validate.ts` like CC's. Keep the secret out of the URL by storing it in `sessionStorage` keyed by game id. Server-side rank verification needs the server to know the choices; the simplest honest version is to have the server store the four choices it was shown for the current ply and reject a `move` not among them, and to treat scores as unverified until then.

### S2. Per-IP limits trust the client-controlled end of `X-Forwarded-For` (medium)

All three `clientIp` implementations (`app/utils/rateLimit.server.ts`, `chesserGuesser/rateLimit.server.ts`, `camelUpCup/tournament.server.ts`) take the first entry of `X-Forwarded-For`. CloudFront appends the real viewer address to whatever the client sent, so the first entry is the attacker's choice. Sending a random value per request gives a fresh bucket each time, which defeats every per-IP limit, including the three-per-hour limit in front of the tournament Lambda (the global four-per-day cap still holds).

Suggested: add `CloudFront-Viewer-Address` to the origin request policy and read that; fall back to the entry CloudFront appended. Put it in one `clientIp()` and delete the other two.

**Verify** also whether the API Gateway `execute-api` URL is reachable directly. If it is, requests can skip CloudFront entirely (caching, and any future WAF or header policy). Disable the default endpoint, or have CloudFront send a secret origin header the Lambda requires.

### S3. Redis TLS verification is disabled (medium)

`app/utils/redis.server.ts` sets `tls: { rejectUnauthorized: false }` for `rediss://` URLs. The connection is encrypted but not authenticated, so anything on the path can impersonate the server and read or alter all game state. Most managed providers now present publicly trusted certificates. Remove the override and see whether the connection still succeeds; if the provider uses a private CA, pin that CA with `tls.ca` instead.

The same file has two reliability gaps:

- `getRedisClient()` discards and recreates the client whenever `status !== 'ready'`, which includes `connecting`. Two calls before the first connection completes will tear down each other's client and fail queued commands. Today's call sites mostly await between calls, so this is latent, but it is one `Promise.all` away. Recreate only on `end` / `close`.
- No `commandTimeout`. A dead socket after a Lambda freeze can hold a request until the 30-second Lambda timeout. Set `commandTimeout` (1–2 s) and `connectTimeout`.

### S4. Unauthenticated endpoints that write to Redis without an IP limit (medium)

These create keys for anyone who asks, with no per-address limit:

| Endpoint                                 | What one request creates          | TTL    |
| ---------------------------------------- | --------------------------------- | ------ |
| `POST /api/multipleChoiceChess/create`   | a 26-field hash + a lobby entry   | 24 h   |
| `POST /api/collaborativeCheckmate/join`  | a game per new code + presence    | 24 h   |
| `POST /api/blunderWatch/submit`          | 2 keys + a leaderboard member per new username | 7 days |
| `POST /api/chesserGuesser/submit`        | up to 3 keys per new username (cooldown is per username, not per address) | 7 days |

A loop with random usernames fills Redis or pushes real entries off a leaderboard. The shared `checkRateLimit()` already exists; call it from each of these once S2 is fixed. **Verify** the Redis `maxmemory-policy` is an evicting one (`volatile-ttl` suits this data) so a fill degrades instead of failing every write.

Smaller input issues in the two daily games:

- `validateUsername(username)` runs a regex against a value that was never checked to be a string. `undefined` is coerced to `"undefined"` and passes; an array of one valid string passes and is then serialised as an array.
- `date` is client-supplied and only format-checked, so past days' leaderboards can be written to for as long as that day's puzzle key exists.
- Usernames are unclaimed, so anyone can post a score under someone else's name. That is fine for a toy leaderboard; worth saying on the page rather than fixing.

### S5. `/healthcheck` fetches a URL built from request headers (low–medium)

`app/routes/healthcheck.tsx` builds a URL from `X-Forwarded-Host` (or `Host`) and `X-Forwarded-Proto` and sends a `HEAD` to it. A caller can point that at any host, and each call to this public route costs a second full Lambda invocation plus a Redis ping. Fetch nothing (a Redis ping answers "is the Lambda up and can it reach Redis"), or use the `SITE_URL` constant.

### S6. Content Security Policy (low, given no sessions)

`script-src` allows `'unsafe-inline'`, `'unsafe-eval'`, `blob:`, and three third-party script hosts (`unpkg.com`, `cdn.jsdelivr.net`, `giscus.app`). The comments in `entry.server.tsx` explain why each is there. What can be tightened, in order of value:

1. **Remove `'unsafe-eval'`** by compiling MDX to real modules (A1). Stockfish and onnxruntime only need `'wasm-unsafe-eval'`.
2. **Self-host Stockfish and onnxruntime-web** under `/assets/`. The reason given in `stockfish.ts` for using unpkg (the 6 MB API Gateway response cap) stopped applying when assets moved to the S3 origin; the bucket has no such limit. This removes two third-party hosts from `script-src`, removes the blob-worker bootstrap, and means a compromise or outage of unpkg / jsDelivr no longer reaches the site. The server already pins SHA-256 hashes for the same Stockfish files; the browser currently has no equivalent check.
3. **`'unsafe-inline'`** can only go with per-request nonces, which conflicts with caching HTML at the edge (P1). For a site with no sessions, caching is the better trade; leave this one.
4. Move the static security headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`) to a CloudFront response-headers policy so they also cover `/assets/*`, `/images/*` and API responses, which currently get none of them.

### S7. Camel Up Cup executes submitted Python (verify)

The site side is careful: size limit, a pre-filter, a single-run lock, a per-day cap that fails closed. The actual boundary is the AST check in the other repository, and Python AST allow-lists have a long history of being escaped. What matters is what an escape can reach. That Lambda writes to the CDN bucket under `images/camel-up/`. **Verify** its role allows `s3:PutObject` on that prefix only. If it can write to the whole bucket, a sandbox escape can replace `/assets/*.js` and take over every page on the site. Also confirm it has no other permissions, no VPC access, and reserved concurrency of 1 (the code comments say it does).

### S8. Cost exposure (verify)

A 2 GB Lambda is reachable by anyone, with API Gateway's default throttle (thousands of requests per second) and no HTML caching. Set a stage throttle on the API (tens of requests per second is generous for this site), a reserved-concurrency ceiling on the Lambda, and an AWS Budgets alert. This is ten minutes of console work and bounds the worst case.

---

## Performance

Measured from a local production build:

| Artifact                                   | Size (raw / gzip)   | Note                                             |
| ------------------------------------------ | ------------------- | ------------------------------------------------ |
| `entry.client` + `jsx-runtime` + `root`    | 340 kB / 112 kB     | Baseline JS on every page                        |
| `index.css`                                | 76 kB / 13 kB       | One stylesheet for all routes                    |
| `runescapeRascals` route chunk             | 125 kB / 23 kB      | Includes the 80 kB `walked-routes.json`          |
| `model-viewer`                             | 1,024 kB / 290 kB   | Lazy-loaded by `TrophyModel.tsx`; fine           |
| Server `index.mjs`                         | 766 kB / 170 kB     | Every route in one module, parsed on cold start  |
| Server `posts.server` chunk                | 124 kB / 34 kB      | 20 posts; `docs/deployment.md` still says ~84 kB |

Client-side code splitting is already good: each project is its own chunk and nothing heavy leaks into the baseline.

### P1. Cache HTML at the edge (high)

No document route exports `headers`, so pages are served with no `Cache-Control` and every page view invokes the Lambda, including cold starts. Blog posts and most project pages render identically for everyone: there are no cookies, and the root loader returns only the GA id.

Suggested, smallest first:

1. Export `headers` from the blog route and the static project routes with something like `Cache-Control: public, max-age=0, s-maxage=3600, stale-while-revalidate=86400`. Browsers always revalidate; CloudFront serves from the edge and refreshes in the background.
2. **Verify** the default CloudFront behavior uses a cache policy that honours origin headers and does not include cookies or unneeded headers in the cache key. The Rascals endpoints already send `s-maxage`, so it is worth confirming that those are in fact being cached.
3. Add an invalidation of `/*` (or just `/`, `/blog/*`, `/feed.xml`, `/sitemap.xml`) at the end of the deploy.
4. Do D1 first. Cached HTML points at old asset hashes for as long as it is cached.

Longer term, React Router's `prerender` option can emit the blog and static project pages as files at build time, which takes the Lambda out of the path for them entirely. It is a bigger change with the current Architect setup and only worth it if step 1 is not enough.

### P2. Polling cost (medium)

Live games and the Rascals page poll through the Lambda. Each poll is an invocation plus at least one Redis round trip, and Multiple Choice Chess returns the full state every time.

- Rascals: the snapshot endpoint sends `s-maxage=10`. Once P1.2 is confirmed, all viewers share one Lambda call per 10 seconds. Nothing else needed.
- Games: add a `version` query parameter and return `304` (or a tiny `{ unchanged: true }`) when the stored version matches. CC already has a version counter.
- `openGames.list()` calls `describe` (a Redis read) per lobby entry in sequence. Use a pipeline; it matters once a lobby has more than a handful of games.

### P3. Redis round trips in the daily games (low)

`POST /api/chesserGuesser/submit` makes about thirteen sequential Redis calls (five in the sliding-window limiter, eight in the handler), and the `completed` counter is a `GET` then `SETEX`, which loses an update under concurrency. A `multi()` for the writes and `INCR` for the counter brings that to three or four round trips. The sliding-window limiter is itself non-atomic (trim, count, add as separate calls); the fixed-window `checkRateLimit()` in `app/utils/rateLimit.server.ts` is simpler and sufficient here. Blunder Watch's submit has the same sequential pattern at smaller scale.

### P4. Images (low)

Of 118 images, 68 are PNG, 47 JPEG and 2 WebP; the largest is 500 kB, so nothing is alarming. Two cheap improvements as the post count grows:

- Add `loading="lazy"` and `decoding="async"` to MDX images with a small rehype plugin (dimensions are already set by `rehype-img-size`, so there is no layout shift).
- Convert to WebP or AVIF in `compile:mdx` or a pre-commit script. `sharp` is already a devDependency.

`app/utils/cdn.ts` exports `getResponsiveSrcSet`, `getModernImageSources`, `preloadImage` and `image()`; none is used, and the first two build URLs for size variants that are never generated. Delete them or build the variants.

---

## Structure

### A1. Blog pipeline: compile posts to modules, split the index from the bodies (high)

Today a post is compiled by `mdx-bundler` to a string of JavaScript, stored in JSON, bundled into one server chunk with every other post, sent to the browser inside the loader payload, and evaluated with `new Function` (`app/routes/blog.$slug.tsx`). Consequences:

- The site needs `'unsafe-eval'` in its CSP for this alone (S6).
- Each post is transferred twice on first load: once as rendered HTML, once as the code string for hydration.
- `posts.server` grows by about 6 kB per post and is loaded whole by the homepage, sitemap and feed loaders, which only need titles and dates.
- The MDX plugin list exists twice (`app/utils/mdx.server.ts` and `scripts/compile-mdx.mjs`, with a "keep in sync" comment), and dev skips the asset-URL rewrite that production applies, so the two paths can drift.

Suggested target:

- Use `@mdx-js/rollup` in `vite.config.ts` with the same remark/rehype plugins. Posts become ordinary modules: `import.meta.glob('../../posts/*.mdx')` (lazy) gives one chunk per post on both server and client, with frontmatter exported via `remark-mdx-frontmatter`.
- Generate a small `posts-index.json` (slug, title, date, type, subtitle, unlisted, ogImage) at build time. Home, sitemap, feed and prev/next read only that.
- One plugin list, one code path for dev and production, no `compile:mdx` step, no `new Function`, no `'unsafe-eval'`.
- The CDN `src` rewrite can go: the CDN has been same-origin since assets moved behind CloudFront, so `/images/...` already resolves correctly.

This is the change that most directly serves "keeps scaling with posts". It touches the build, so it needs the `verify-lambda-deps` check and a bot-user-agent request against a post before deploying.

### A2. One registry for projects (medium)

Adding a project currently means editing `app/routes.ts`, `STATIC_PATHS` in the sitemap, `staticLinks` and `CATEGORY_BY_KEY` in `_index.tsx`, `projectCards.json`, `commitlint.config.js`, and often the CSP. `CLAUDE.md` documents the list because it is easy to miss one.

Suggested: a single `app/projects.ts` exporting an array of `{ slug, title, description, category, listed, indexable, card, legacyPaths, scope }`. The sitemap, homepage, share-card lookup and legacy redirects derive from it; `routes.ts` can map over it for the page routes; a CI check asserts every `scope` appears in `commitlint.config.js`. Adding a project becomes one entry plus its route file.

The twenty legacy-redirect route entries collapse into a lookup table handled in the catch-all route (or a CloudFront Function, which would answer them without the Lambda).

### A3. Shared server helpers (medium)

Small duplicated pieces that have already drifted apart:

- `clientIp` ×3, `getTodayDateString` ×3 (the Blunder Watch copies use UTC; Chesser Guesser has a separate time-zone-aware module), `validateUsername` ×2, two rate limiters with different semantics.
- Each older API route repeats method checks, `try/catch` to a JSON 500, and ad-hoc body validation.

Suggested: `app/utils/http.server.ts` with `clientIp`, `json`/`jsonError`, `readJsonBody(request, maxBytes)` (lifted from the Media Profile route, which is the only one that limits body size) and a `withRateLimit` wrapper; one username/date validator. A schema library (`valibot` is small) or the hand-written `validate.ts` pattern from Collaborative Checkmate, applied to the Chesser Guesser, Blunder Watch and Multiple Choice Chess bodies, which are currently cast with `as` and trusted.

### A4. Document response handling (low)

`app/entry.server.tsx` has two near-identical functions differing only in `onAllReady` vs `onShellReady`, an abort timer that is never cleared, and template comments from Remix. Merge into one function parameterised on the callback name and clear the timer when the stream finishes. `server.ts` has "WORKAROUND" comments describing a problem the code no longer works around; the static-file fallback for the sandbox could move to a dev-only module so the production handler is ten lines.

### A5. Observability (medium)

Errors go to `console.error` and nowhere else. The 2026-06-10 incident (routes returning 500 to bots only) was the kind of failure nobody sees in a browser. Suggested minimum: CloudWatch alarms on Lambda `Errors` and API 5xx rate sending email through SNS, and an uptime check that requests a blog post with a bot user agent after each deploy (the manual step in the `verify-lambda-deps` skill, automated as the last step of the workflow).

### A6. Tests and housekeeping (low)

- `tests/visual/` snapshots are `*-chromium-darwin.png` and the suite is not in CI, so it only runs on a Mac and only when remembered. Either run it in CI in a Linux container with Linux baselines, or delete it in favour of `pr-screenshots`, which covers the same need.
- API tests exist for most endpoints but there are none for Multiple Choice Chess `state`, `join`, `resign` or `claimWin`. A test asserting that `state` never returns `white_id` / `black_id` would have caught S1.
- `AGENT.md`, `AGENTS.md` and `CLAUDE.md` are three copies of the same 24 lines. Keep one and symlink the others, or add a CI check that they are identical.
- Seven CI jobs each run `npm ci`. Fine at this size; if minutes matter later, one job with sequential steps or a shared `node_modules` cache halves the wall-clock time.
- `docs/deployment.md` figures are stale in places (`posts.server` size, the `ioredis` floor). Low value to fix by hand; A1 removes the first.

---

## Suggested order

1. **One small PR each, this week:** D1 (deploy ordering and cancellation), S1 (stop returning ids; random ids), S2 (`clientIp`), S3 (Redis TLS and timeouts), S5 (healthcheck), D3 (`npm audit fix`, Dependabot for npm).
2. **Console work, an hour:** S8 (throttle, concurrency, budget), S7 (tournament role scope), D4 (OIDC), verify the P1.2 cache policy and S2's direct-endpoint question.
3. **Next:** P1 (HTML caching), S4 (rate limits on writers), D2 (locked Lambda deps), D7 (one image tree).
4. **When the next few posts or projects are coming anyway:** A1 (MDX as modules), A2 (project registry), A3 (shared helpers), then the rest of S1 (port Multiple Choice Chess to the Collaborative Checkmate pattern).
5. **Opportunistic:** S6.2 (self-host engines), D5 (infrastructure as code), A5, A6, D9, P2–P4.
