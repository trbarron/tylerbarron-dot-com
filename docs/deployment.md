# Deployment architecture

Operational gotchas for the Architect-deployed Lambda + CloudFront setup. Referenced
from `CLAUDE.md`, which keeps only the rules you can violate without meaning to.

## Lambda zip: SSR build + handler + prod node_modules (no client assets)

The deployed Lambda (`server/`) contains the SSR build (`build/server/`, including the
~84 KB `posts.server` chunk of compiled MDX) plus the esbuilt `index.mjs` and prod
`node_modules`. Client assets, fonts, and blog images are **not** in the Lambda —
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

## Blog posts are bundled, not fetched from S3

`npm run compile:mdx` writes compiled posts to `app/posts/compiled/*.json` (gitignored).
`app/utils/posts.server.ts` bundles them into the SSR build via `import.meta.glob`
(prod) or compiles `posts/*.mdx` on the fly (dev, gated by `import.meta.env.DEV` so
`mdx-bundler` is tree-shaken from prod). Image `src`s are rewritten to `VITE_CDN_URL` at
compile time — so `compile:mdx` must run with that env set (CI Build step does). No
runtime S3 fetch for posts.

## Lambda response size cap is 6 MB (effectively ~4.5 MB raw)

API Gateway rejects Lambda responses larger than 6 MB. Because the handler
base64-encodes binary assets (~1.33× expansion), the practical raw-file limit is
~4.5 MB. Symptom of going over: HTTP 500 with body `{"message":"Internal Server Error"}`
and an `apigw-requestid` header. The Stockfish WASM (7.3 MB) hit this — now offloaded to
unpkg CDN; see `app/utils/multipleChoiceChess/stockfishEngine.ts`.

## Lambda dependencies: two lists that must stay in sync

The Lambda installs `server/package.json` (a separate, hand-maintained list: the AWS
preset, `chess.js`, `ioredis`, `isbot`, `react`, `react-dom`, `react-router`,
`@aws-sdk/client-lambda`) — ~15 MB installed, dominated by `react-dom` (4.4 MB) and
`react-router` (4 MB).

`@aws-sdk/client-lambda` is the **only** AWS SDK package in the Lambda, and it is there
on purpose: `app/utils/camelUpCup/tournament.server.ts` invokes the tournament Lambda at
runtime. `@aws-sdk/client-s3` is *not* — it stays a devDependency used only by the
upload scripts. Both are devDependencies in the root `package.json`, so the root list
tells you nothing about what ships; `server/package.json` is the authority.

The Vite SSR build externalizes all npm deps, so anything an SSR-rendered module imports
must either be in `server/package.json` or listed in `ssr.noExternal` in
`vite.config.ts` (currently `chessground`, `d3-geo`, `d3-array`, `topojson-client` —
bundled tree-shaken into `build/server`).

Getting this wrong 500s those routes **for bots/curl only** (`onAllReady` path);
browsers recover client-side via `onShellReady`, so the breakage hides from casual
testing (2026-06-10 incident). Run the `verify-lambda-deps` skill after a build that
touched imports.

## Versioning (automated semver in the footer)

Releases are **fully automated by semantic-release** (`.releaserc.json`), driven by
[Conventional Commits](https://www.conventionalcommits.org): `fix:` → patch, `feat:` →
minor, `feat!:`/`BREAKING CHANGE:` → major. Other types (`chore:`, `ci:`, `docs:`,
`refactor:`, `perf:`, `test:`) don't release.

Flow: on push to `master`, the deploy job runs `npx semantic-release` **before** the
build. It analyzes commits since the last tag, and if a release is warranted it bumps
`package.json` on disk, writes `CHANGELOG.md`, and commits + tags `X.Y.Z` (prefix-less,
`tagFormat: "${version}"`, matching the legacy `5.0.24` tag). The commit message carries
`[skip ci]` to avoid re-triggering. The build then reads the bumped `package.json`.

Because that release commit lands on `master` mid-deploy, a local push made while a
deploy is running gets rejected as non-fast-forward. Rebase onto `origin/master` and
push again — `pull.rebase` is already true, and release commits only touch
`package.json`, `package-lock.json`, and `CHANGELOG.md`, so conflicts are unlikely.

The GitHub Release object is created by a separate **non-blocking** `gh release create`
step in `deploy.yml` (not `@semantic-release/github`): it's the only release action that
would run after the tag is pushed but before the deploy, and a transient GitHub API
failure there once aborted a deploy and left a tagged-but-undeployed state (2026-06-10
outage). If that step gets skipped by an outage, the Release for that tag stays missing
(tags are the source of truth; semantic-release doesn't read Releases) — recreate it
with:

```bash
git log -1 --format=%b <tag> | gh release create <tag> --title <tag> --verify-tag --notes-file -
```

`package.json` `version` is the footer's source of truth: `vite.config.ts` injects it as
`__APP_VERSION__` (and the short commit hash as `__GIT_COMMIT__`); `Footer.tsx` renders
`v<version> · <hash>`. The deploy checkout uses `fetch-depth: 0` so semantic-release can
see all tags/history. To cut a release you just push conventional commits — no manual
version step. Validate locally with:

```bash
GITHUB_TOKEN=$(gh auth token) npx semantic-release --dry-run --no-ci
```

Commit messages are enforced locally: a **Husky** `commit-msg` hook (`.husky/commit-msg`)
runs **commitlint** (`.commitlintrc.json`, extends `@commitlint/config-conventional`) and
rejects non-conventional messages. The hook installs via the `prepare` script on
`npm install`; CI sets `HUSKY=0` so it never runs against semantic-release's own release
commit.
