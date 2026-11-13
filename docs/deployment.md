# Deployment architecture

Operational gotchas for the Architect-deployed Lambda + CloudFront setup. Referenced
from `CLAUDE.md`, which keeps only the rules you can violate without meaning to.

## Lambda zip: SSR build + handler + prod node_modules (no client assets)

The deployed Lambda (`server/`) contains the SSR build (`build/server/`, including one
chunk per blog post) plus the esbuilt `index.mjs` and prod `node_modules`. Client assets, fonts, and blog images are **not** in the Lambda —
they're served **same-origin through CloudFront**: the asset bucket is an origin on the
`tylerbarron.com` distribution (E1TUWNZL0WZZ6J) with `/assets/*`, `/fonts/*`,
`/images/*` behaviors (CachingOptimized, `Compress: True`). `VITE_CDN_URL` is
`https://tylerbarron.com`, and CI syncs the bucket in the "Publish assets + images to
CDN bucket" step. The `/assets/*`, `/fonts/*`, `/images/*` static fallback in
`server.ts` only runs in the local `arc sandbox` (`ARC_ENV !== 'production'`).

CloudFront compresses on a delay: a freshly synced file serves **uncompressed** for the
first several requests (even on `x-cache: Hit`) while the edge populates the brotli
variant out of band. Don't diagnose a compression problem from one cold `curl` — hit it
a dozen times over a couple of minutes first. Objects under 1,000 bytes are never
compressed at all.

## Blog posts are ordinary modules

`posts/*.mdx` are compiled by `@mdx-js/rollup` as part of the Vite build
(`scripts/lib/vite-posts.mjs`); there is no separate compile step, and dev and production
take the same path. Each post is its own chunk on the server and in the browser, loaded
through `app/utils/postModules.ts`. The blog route's loader awaits the post before
rendering, so the post is in the server's HTML; in the browser the chunk is fetched
alongside the route's data on navigation.

Listings (homepage, feed, sitemap, prev/next) read `virtual:posts-index`, a build-time
map of slug to frontmatter served by the same Vite plugin. They never import a post body,
so the cost of a listing doesn't grow with the length of the posts.

Images in posts are referenced as `/images/...` and left that way: the CDN is the same
origin as the site.

## What happens to the previous build on deploy

The deploy uploads `build/client/assets/` **without** `--delete`. The previous build's
hashed files have to outlive the deploy: the Lambda still in production renders HTML that
points at them until `arc deploy` finishes, edge-cached pages point at them for as long as
they are cached, and so do tabs that are already open. After the deploy,
`scripts/prune-old-assets.mjs` deletes files under `assets/` that are both older than 30
days and absent from the build just shipped. (An S3 lifecycle rule would be wrong here: a
file whose content didn't change keeps its old upload date, so a quiet month would expire
the live site's assets.)

Runs on `master` are never cancelled by a newer push (`concurrency` in `deploy.yml`); a
deploy cancelled between publishing assets and updating the Lambda is the half-state this
avoids.

## Pages cached at the edge

Routes that render the same HTML for everyone export `headers` from `~/utils/cache`
(`s-maxage=300, stale-while-revalidate=86400`, `max-age=0` for browsers):
the homepage, blog posts, and the static project pages. `tests/utils/pageCache.test.ts`
lists them and fails if one starts reading the request or Redis. Don't add it to a route
whose loader reads live data or whose server render depends on the query string (Pizza
Rating's `?town=`, Maia's `?deck=`). The deploy ends with a `/*` invalidation
(non-blocking).

On 12 November 2026 the default behavior was changed from managed `CachingDisabled`
to `site-honour-origin` (`85e06858-fe24-40d4-b9e8-ae426f6156a9`), defined in
`infra/cloudfront/honour-origin.json`. Minimum and default TTL are zero; maximum TTL
is one year. All query strings participate in the key; cookies and viewer headers do
not. The existing `AllViewerExceptHostHeader` origin request policy is unchanged,
as are the three asset behaviors, the response headers policy and the `www` redirect.

Live requests confirmed hits for `/`, `/blog/2026Goals` and the Rascals snapshot;
Chesser Guesser, Maia, available games and the `no-store` healthcheck stayed misses.
Two different query strings caused separate misses. To recheck caching, request a URL
twice with `curl -sS -D - -o /dev/null https://tylerbarron.com/` and inspect `x-cache`,
`age` and `cache-control`. Repeat for `/blog/2026Goals` and the snapshot (expect a hit),
and `/chesser-guesser`, `/marginal-maia-mentor`, `/api/multipleChoiceChess/available`
and `/healthcheck` (expect misses). Run `node scripts/check-live-site.mjs` for bot
rendering and Redis health. A POST created a game and its
state was readable by query string. The `www` redirect still preserves path and query.
Missing blog pages returned 404 (`Error from cloudfront`); their second response had
an `Age` header, showing CloudFront's separate short error cache still applies. The
policy does not promise zero caching of error responses; review error TTL separately
if immediate recovery of a missing URL is needed.

Rollback snapshot for this change: `/private/tmp/site-audit-20261112/distribution-before.json`
on the executing machine. Restore its `DistributionConfig` using a fresh distribution
ETag. That file is a local operational backup, not committed infrastructure state.

## Whose address a rate limit sees

`clientIp()` in `app/utils/rateLimit.server.ts` prefers `CloudFront-Viewer-Address`,
which CloudFront sets itself, over the first `X-Forwarded-For` entry, which the client
chooses. CloudFront only sends that header when the default behavior's origin request
policy includes it; without it the limits still work for honest traffic but can be
dodged by sending a different `X-Forwarded-For` each time.

## Camel Up Cup: queued and emailed, never run here

A submitted bot is stored in the Redis hash `camelup:pending` (at most 25 waiting) and
announced by email through the SNS topic named in `CAMEL_NOTIFY_TOPIC_ARN`; the email
includes the bot's code. Nothing on the site executes it. `npm run camel:queue` lists the
waiting bots, `-- pull [dir]` writes them out as `.py` files, and `-- done <id>` removes
them after the tournament, which is run by hand and publishes `leaderboard.json` under
`images/camel-up/` as before. The Lambda's role needs `sns:Publish` on that topic; without
it, or without the variable, submissions are still queued and the failure is logged.

Submission email was verified end to end on 13 November 2026: the owner confirmed
receipt of both the direct SNS test and the live `NotificationCheck` bot email.
The test entry was verified in Redis and only that entry was removed; the queue
was empty afterwards. No submitted code was executed.

- SNS topic: `camel-up-cup-submissions`, ARN
  `arn:aws:sns:us-west-2:027237787789:camel-up-cup-submissions`.
- Site role inline policy: `camel-notify`, defined in `infra/iam/camel-notify.json`;
  it grants only `sns:Publish` to that topic.
- Architect production parameter:
  `/tb-website-remix/production/CAMEL_NOTIFY_TOPIC_ARN` (SecureString), activated by
  production deploy `43294486638`. The confirmed email address lives only in SNS.
- The old execution infrastructure, dedicated role/policy, site invocation grant
  and obsolete environment setting were removed with owner approval on 13 November.
  The live site configuration retains the notification setting. Email permission,
  the leaderboard object and all five live bot health checks passed afterwards.
- Private configuration/policy backups and the hash-verified code archive are kept
  outside the repository in `/private/tmp/camel-retirement-20261112` and
  `/private/tmp/camel-retirement-20261113`. These may contain secrets; do not commit
  them. The separate local tournament runner remains audit task 27.

## Content-Security-Policy: eval on the Maia page only

`app/utils/csp.server.ts` builds the policy per document. Every page gets
`'wasm-unsafe-eval'`; only `/marginal-maia-mentor` gets `'unsafe-eval'`, because
onnxruntime-web's WebGPU build uses `new Function`. A policy is fixed when a document
loads, so that page must never be entered by client-side navigation: its route's
`clientLoader` turns any such navigation into a full page load, its empty `loader` keeps
that from running on first load (which would loop), and `shouldRevalidate` keeps `?deck=`
changes from reloading. A new page that needs eval goes in `EVAL_PAGES` and needs the same
three exports.

## Redis

`app/utils/redis.server.ts` verifies the server's TLS certificate. A provider with a
certificate no public CA signed needs `REDIS_TLS_REJECT_UNAUTHORIZED=0` in `@env`
(`arc env --add --env production REDIS_TLS_REJECT_UNAUTHORIZED 0`); prefer fixing the
certificate. Commands time out after 5 seconds.

## Lambda response size cap is 6 MB (effectively ~4.5 MB raw)

API Gateway rejects Lambda responses larger than 6 MB. Because the handler
base64-encodes binary assets (~1.33× expansion), the practical raw-file limit is
~4.5 MB. Symptom of going over: HTTP 500 with body `{"message":"Internal Server Error"}`
and an `apigw-requestid` header. The Stockfish WASM (7.3 MB) hit this — now offloaded to
unpkg CDN; see `app/utils/chess/stockfish.ts`.

## Lambda dependencies: two lists that must stay in sync

The Lambda installs `server/package.json` (a separate, hand-maintained list: the AWS
preset, `@react-router/node`, `chess.js`, `ioredis`, `isbot`, `react`, `react-dom`,
`react-router`) — ~17 MB installed, dominated by `react-dom` (7.9 MB) and `react-router`
(5 MB).

That file decides **which** packages ship, not which versions. `npm run build:arc:deps`
(`scripts/install-lambda-deps.mjs`) installs each one at exactly the version in the root
`package-lock.json`, so the Lambda runs what the build compiled against and the tests ran
against, and a package listed there must also be in the root `package.json`.
`check:lambda-deps` fails on a version mismatch as well as a missing package.

No AWS SDK package ships. `app/utils/camelUpCup/tournament.server.ts` does use
`@aws-sdk/client-sns` to email a Camel Up Cup submission, but Lambda's Node runtime
includes the AWS SDK v3, so it resolves there; bundling the SDK (with `@smithy/*`)
doubled the Lambda to 36 MB. It's imported dynamically inside `notifySubmission`, so only
a submission loads it. Locally it resolves from the root devDependency. AWS recommends
bundling the SDK so a runtime update can't change its version under you; for one
`PublishCommand` that risk is small, and a failed email never loses a submission (the
bot is already in Redis). `@aws-sdk/client-s3` is a devDependency used only by the upload
scripts. Root membership tells you nothing about what ships; `server/package.json` is the
authority.

The Vite SSR build externalizes all npm deps, so anything an SSR-rendered module imports
must either be in `server/package.json` or listed in `ssr.noExternal` in
`vite.config.ts` (currently `chessground`, `d3-geo`, `d3-array`, `topojson-client` —
bundled tree-shaken into `build/server`).

Getting this wrong 500s those routes **for bots/curl only** (`onAllReady` path);
browsers recover client-side via `onShellReady`, so the breakage hides from casual
testing (2026-06-10 incident). CI's `lambda-deps` job assembles `server/` the way the
deploy does and runs `scripts/check-lambda-deps.mjs`, which fails when a bare import in
the bundle isn't installed in `server/node_modules`. The `verify-lambda-deps` skill
covers the manual check: requesting a route as a bot.

## Stockfish in the Lambda: downloaded on first use, not shipped

Collaborative Checkmate decides disagreements with Stockfish on the server
(`app/utils/chess/stockfish.server.ts`), but the engine isn't in the Lambda zip. The first
search in a container downloads the two files it needs (18 lite single-threaded, ~7 MB)
from unpkg, the same pinned version the browser games load, checks each against a
pinned SHA-256, and keeps them in `/tmp` for the container's life. That costs about half
a second on a cold container's first disagreement and nothing after. A failed or
mismatched download is refused, and that turn falls back to the first player's move.
Bumping the version means new hashes (the command is in the file). In dev and tests the
files come from the `stockfish` devDependency, which never ships (it's 251 MB).

## Versioning (automated semver in the footer)

Releases are **fully automated by semantic-release** (`release` in `package.json`), driven by
[Conventional Commits](https://www.conventionalcommits.org): `fix:` and `perf:` → patch,
`feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major (commit-analyzer's default rules). The optional scope names the project (`feat(rascals): …`); the allowed list is `commitlint.config.js`.
Other types (`chore:`, `ci:`, `docs:`, `refactor:`, `test:`) don't release.

Flow: on push to `master`, `scripts/plan-release.mjs` calls semantic-release's
JavaScript API with `dryRun: true` to compute the next version without changing files
or publishing a tag. The build receives that version as `APP_VERSION`; changes that
do not warrant a release keep the current `package.json` version.

The workflow builds, publishes assets and deploys the Lambda, then runs
`scripts/check-live-site.mjs` against the homepage, a blog post, the chess lobby,
the pizza map and the Redis healthcheck as Googlebot. Requests use a deployment query
parameter, a timeout and bounded retries. Page footers must show the planned version
and source commit, so an old cached page cannot pass the deploy check. This relies on
the HTML cache policy including the query string (as configured above).

Only after the deploy and live check succeed does `npx semantic-release` bump
`package.json`, commit and tag `X.Y.Z` (prefix-less, `tagFormat: "${version}"`).
The release commit keeps `[skip ci]` to avoid re-triggering. A build, upload, deploy
or smoke-check failure therefore leaves no new release tag. A release failure after
deployment is still possible; inspect the run rather than assuming a tag was published.
There is no `CHANGELOG.md`: release notes live in the commit body and GitHub Release.

Because that release commit lands on `master` near the end of a deploy, a local push made while a
deploy is running gets rejected as non-fast-forward. Rebase onto `origin/master` and
push again — `pull.rebase` is already true, and release commits only touch
`package.json` and `package-lock.json`, so conflicts are unlikely.

The GitHub Release object is created by a separate **non-blocking** `gh release create`
step in `deploy.yml` (not `@semantic-release/github`), after deployment and tagging.
A transient GitHub API failure in this step once aborted a deploy and left a
tagged-but-undeployed state (2026-06-10 outage); it remains non-blocking. If that step gets skipped by an outage, the Release for that tag stays missing
(tags are the source of truth; semantic-release doesn't read Releases) — recreate it
with:

```bash
git log -1 --format=%b <tag> | gh release create <tag> --title <tag> --verify-tag --notes-file -
```

`vite.config.ts` injects `APP_VERSION` (falling back to `package.json` `version`) as
`__APP_VERSION__` (and the short commit hash as `__GIT_COMMIT__`); `Footer.tsx` renders
`v<version> · <hash>`. The deploy checkout uses `fetch-depth: 0` so semantic-release can
see all tags/history. To cut a release you just push conventional commits — no manual
version step. Validate locally with:

```bash
GITHUB_TOKEN=$(gh auth token) npx semantic-release --dry-run --no-ci
```

Commit messages are enforced locally: a **Husky** `commit-msg` hook (`.husky/commit-msg`)
runs **commitlint** (`commitlint` in `package.json`, extends `@commitlint/config-conventional`) and
rejects non-conventional messages. The hook installs via the `prepare` script on
`npm install`; CI sets `HUSKY=0` so it never runs against semantic-release's own release
commit.

## Running the live check manually

`node scripts/check-live-site.mjs` checks production; pass an origin URL as its first
argument to check another deployment. Set `APP_VERSION` and `GITHUB_SHA` together to
require an exact build in the footer. Without `APP_VERSION`, it checks server-rendered
HTML and Redis health without requiring a particular release. This is read-only.

On 12 November 2026, the live healthcheck returned `200 OK`, the Multiple Choice Chess
available-games endpoint returned `200`, and all five bot smoke checks passed. No Redis
TLS opt-out was added. The provider certificate and production environment variables
were not inspected, so this confirms operational health rather than independently
proving certificate verification is enabled.

## Deploy invalidation permission

The 12 November deploy run `43255646885` failed its non-blocking invalidation step:
IAM user `remix-deployer` lacked `cloudfront:CreateInvalidation`. Asset pruning
succeeded (`236 objects under assets/, 117 in this build, 0 to prune`). The user now
has inline policy `invalidate-site`, defined in `infra/iam/site-invalidation.json`,
scoped to distribution `E1TUWNZL0WZZ6J`. IAM simulation returned `allowed`; confirmation
from a subsequent deploy run remains pending. There was no previous inline policy
of this name. The user policy list was saved alongside the distribution rollback.

## Infrastructure findings still awaiting decisions

- The existing viewer-request function is `www-to-apex-redirect`. Task 06 must extend
  it carefully rather than replace its association with a second function. Its live
  source was saved in `/private/tmp/site-audit-20261112/www-to-apex-live.js`. No function
  change has been applied. The direct API healthcheck at the `4qklz67ic3` API origin
  still returns 200; closing that bypass requires the planned origin-secret rollout.
- The production API `4qklz67ic3` (`TbWebsiteRemixProduction`), `$default` stage,
  already has rate 50 requests/second and burst 100. The site Lambda is
  `TbWebsiteRemixProduction-AnyCatchallHTTPLambda-W9sc2MIDWGc5`, role
  `TbWebsiteRemixProduction-Role-ug891mYULLZo`. It has no reserved concurrency;
  observed maximum concurrency from 29 October through 12 November was 56, so
  the audit's suggested cap of 20 would cut below observed traffic. No concurrency
  cap was added. Account quota: 1000 concurrent executions, 999 unreserved at inspection.
- Budget `Monthly Budge` already has a USD 5 monthly limit, actual-spend thresholds
  at 80% and 100%, and a forecast threshold at 100%. Subscriber addresses and delivery
  were not inspected; no budget or notification was changed.
- The default behavior already uses response headers policy `RemixAPIPolicy`
  (`c57b2c88-4e22-4839-8e17-2001d835bfca`), with CORS configuration and empty security
  header sections. Task 15's instruction to stop when a policy exists applies:
  preserve the CORS configuration when preparing a later security-header change.

## Changing CloudFront safely

Before any distribution change, save `aws cloudfront get-distribution-config --id
E1TUWNZL0WZZ6J` to a private local file. It contains the ETag and full
`DistributionConfig`; it may also contain origin secrets, so never commit it. Make a
separate JSON file containing only `DistributionConfig`, edit the intended fields,
and compare it with the original before applying. Use `aws cloudfront
update-distribution --id E1TUWNZL0WZZ6J --if-match <saved-etag>
--distribution-config file://<edited-config>`; an ETag mismatch means inspect again,
not retry blindly. Wait for distribution status `Deployed`, then run the cache and
live-site checks above. To roll back, fetch a fresh ETag and apply the saved original
`DistributionConfig`, then invalidate `/*`. Preserve unrelated origins, behaviors,
edge functions and response-header policies on every change.
