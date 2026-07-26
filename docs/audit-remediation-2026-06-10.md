# Audit Remediation Plan — 2026-06-10

Findings from the codebase/deployment audit, ordered by priority. Each item is
done and verified before moving to the next.

## Status

- [x] 1. Fix SSR 500s (missing server deps) — `ssr.noExternal` in vite.config.ts; verified via isolated Lambda-sim import test
- [x] 2. Fix /healthcheck 500 (hardcoded http://) — scheme from X-Forwarded-Proto; 6 new tests
- [x] 2b. (added) Harden release pipeline against GitHub API outages — GitHub Release
      creation moved from @semantic-release/github to a non-blocking `gh` step in
      deploy.yml; missing 5.1.2 Release backfilled manually. Root cause of the
      2026-06-10 failure was a GitHub platform outage (status: major), not config.
- [x] 3. Serve assets through CloudFront with compression — went same-origin instead
      of a new distribution: added the asset bucket as an origin on the existing
      tylerbarron.com distribution (E1TUWNZL0WZZ6J) with /assets/*, /fonts/*,
      /images/* behaviors (CachingOptimized + compress). VITE_CDN_URL secret now
      https://tylerbarron.com; redeployed and verified: HTML has 0 raw-bucket refs,
      assets/images/fonts serve same-origin with brotli + edge caching. Follow-ups
      folded into item 4/5: drop the now-unneeded S3 CORS step; confirm the legacy
      /build/* behavior + old Architect static bucket are dead. NOTE: update local
      .env VITE_CDN_URL to https://tylerbarron.com.
- [x] 4. De-duplicate deploy.yml and build:arc scripts — workflow now runs
      `npm run build:arc` (single source of truth); removed no-op serverBundles
      (build/server is flat again), stale index.js cp, and the bucket-CORS step
      (assets are same-origin now); install flags aligned (--omit=dev); fixed
      broken `start` script (index.js → index.mjs). Verified: isolated Lambda sim
      imports all chunks AND serves a synthetic API GW request (200 HTML).
      Deferred (infra, needs approval): delete the dead /build/* CloudFront
      behavior + legacy Architect static-bucket origin.
- [x] 5. Remove dead code and dead config — deleted dynamo.server.ts; uninstalled
      @aws-sdk/client-dynamodb + lib-dynamodb; stripped Supabase from app.arc,
      deploy.yml, .env, .env.example; app.arc @env now matches SSM reality
      (NODE_ENV, REDIS_TLS_URL, GA_TRACKING_ID); .env/.env.example point
      VITE_CDN_URL at https://tylerbarron.com. Found via `arc env`: SSM also holds
      SESSION_SECRET (unused by app code — candidate for SSM cleanup) and Redis is
      in us-east-1 while Lambda is us-west-2 (cross-region latency — future item).
- [x] 6. Correct documentation (CLAUDE.md, README) — CLAUDE.md: Lambda/CDN section
      reflects same-origin CloudFront; stale "@aws-sdk is the bloat" section replaced
      with the server/package.json ⟷ ssr.noExternal sync contract + audit one-liner;
      Active Technologies corrected (MDX is bundled, not S3). README: automated
      CI/CD deployment described, CloudFront claim now true, prettier.config.mjs.
- [x] 7. Repo housekeeping — untracked playwright-report/index.html and
      test-results/.last-run.json (predated their .gitignore rules); .gitignore
      already covered ruvector.db (*.db) and all claude-flow artifacts.
- [x] 8. (deferred items, done 2026-06-10) Removed the dead /build/* CloudFront
      behavior + legacy Architect static-bucket origin (it was serving stale SPA
      fallback HTML for any /build/* path; now falls through to the app's 404).
      Removed unused SESSION_SECRET from SSM (production + staging). Deleted dead
      GitHub secrets: SUPABASE_URL, SUPABASE_ANON_KEY, VITE_SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY, PORT — remaining secrets exactly match deploy.yml.
      Redis stays in us-east-1 by choice (revisit if API latency matters).
- [x] 9. (found while verifying #8) Removed the CloudFront CustomErrorResponse that
      rewrote every origin 404 into a 200 serving the homepage (SPA-era relic;
      caused soft-404s for crawlers on all unknown URLs and missing assets). The
      Lambda returns real 404s (verified in sim) and app/root.tsx has a styled
      ErrorBoundary with explicit 404 handling, so 404s now pass through properly.

---

## 1. SSR 500s on /blunder-watch, /chesser-guesser, /pizza-rating

**Problem.** The Vite SSR build externalizes all npm deps. Server route chunks
in `build/server/root/assets/` contain bare imports of `chessground`, `d3-geo`,
and `topojson-client`, but `server/package.json` doesn't list them, so the
Lambda can't resolve them. Browsers recover client-side (`onShellReady` returns
a 200 shell), but bots/curl hit the `onAllReady` path and get HTTP 500 —
crawlers have been seeing 500s on these routes.

**Fix (chosen for performance).** Bundle the pure-JS UI deps into the SSR build
via `ssr.noExternal` in `vite.config.ts` (`chessground`, `d3-geo`, `d3-array`,
`topojson-client`) instead of adding them to `server/package.json`. Bundling is
tree-shaken (only used code ships), adds nothing to Lambda `node_modules`, and
avoids module-resolution work at cold start. No runtime perf cost — strictly
less code than installing the packages.

**Steps.**
1. `git pull` (local is one commit behind origin — 5.1.1 release bump).
2. Add `ssr.noExternal` to `vite.config.ts`.
3. `npm run build`, then audit: every bare import remaining in `build/server/`
   must exist in `server/package.json` (the preset's peer deps `react-router`
   and `@react-router/node` are auto-installed by npm).
4. `npm test`, `npm run typecheck`, `npm run lint`.
5. Commit as `fix:` (triggers a patch release + deploy on push).
6. After deploy: `curl -s -o /dev/null -w "%{http_code}" https://tylerbarron.com/blunder-watch`
   (and chesser-guesser, pizza-rating) — expect 200.

## 2. /healthcheck returns 500

**Problem.** `app/routes/healthcheck.tsx` self-fetches `http://${host}/`.
API Gateway/CloudFront is HTTPS-only, so the fetch fails and the catch returns
500. Redis itself is healthy (leaderboard API works).

**Steps.**
1. Use `https://` (derive from `X-Forwarded-Proto` with https fallback).
2. Same verification flow; after deploy expect `/healthcheck` → 200 "OK".

## 3. Assets served from raw S3, uncompressed

**Problem.** `VITE_CDN_URL` points at the raw S3 bucket endpoint. No
`Content-Encoding` (JS/CSS ship uncompressed), no edge caching. ~6.7 MB client
build, single region.

**Steps (requires AWS console/CLI work + secret change).**
1. Create a CloudFront distribution with the bucket as origin
   (`remix-website-writing-posts.s3.us-west-2.amazonaws.com`), compression
   enabled (gzip + brotli), `CachingOptimized` policy, HTTPS.
2. Update the `VITE_CDN_URL` GitHub secret to the new distribution domain.
3. Redeploy (any `fix:` push) so the HTML references the new asset host.
4. CORS config already allows `*` origins; keep the existing S3 CORS step.
5. Verify: asset response has `content-encoding: br|gzip` and `x-cache` header.

## 4. deploy.yml duplicates build:arc (and has drifted)

**Problem.** The workflow copy-pastes the esbuild command and uses different
npm install flags (`--omit=dev` vs `--production --no-optional`). The
`build:arc:server` script still does `cp build/server/index.js …` — that file
no longer exists since `serverBundles` moved output to `root/index.mjs`; the
`|| true` masks it. `serverBundles` in `react-router.config.ts` is itself a
no-op (always returns "root") and only adds path indirection.

**Steps.**
1. Remove the `serverBundles` no-op; update `server.ts` import path to
   `./build/server/index.mjs`.
2. Fix `build:arc:server` (drop the stale `cp`), align `build:arc:deps` flags
   with CI (`--omit=dev`).
3. Make deploy.yml call the npm scripts instead of inlining them.
4. Verify with `npm run test:deploy` + `npm run dev:arc` smoke test.

## 5. Dead code / dead config

**Problem.**
- `app/utils/dynamo.server.ts` — nothing imports it.
- `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb` in root `dependencies` — unused.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` in `app.arc` and `deploy.yml` — no Supabase usage anywhere.
- `app.arc` `@env` omits `REDIS_URL`, which the app hard-requires (it lives in SSM only) — add it to the list (or document why not).

**Steps.** Delete the file, remove the deps (`npm uninstall`), strip Supabase
from `app.arc`/`deploy.yml`, reconcile the `@env` list. Verify build + tests.

## 6. Documentation corrections

- CLAUDE.md: "runtime AWS usage is client-dynamodb + lib-dynamodb only" → runtime AWS SDK usage is zero (after item 5).
- CLAUDE.md: node_modules "top offenders" list (@aws-sdk 10 MB, @smithy 7.7 MB) is stale — those were extraneous local installs; deployed Lambda is ~11–12 MB.
- CLAUDE.md: static fallback handles `/assets/`, `/fonts/`, `/images/` (not just `/images/*`).
- README: "CloudFront for CDN" — false until item 3 lands; update to match reality.
- README: `prettier.config.cjs` → `prettier.config.mjs`.

## 7. Repo housekeeping

- `git rm --cached playwright-report/index.html test-results/.last-run.json` (tracked despite .gitignore).
- Add gitignore entries for local tooling clutter: `ruvector.db`, `.hive-mind/`, `.swarm/`, `.claude-flow/`, `coordination/`, `memory/`, `claude-flow`.
