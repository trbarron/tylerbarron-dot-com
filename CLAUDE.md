# Claude Code Configuration

## Project Overview

This is a personal website built with React Router 7, TypeScript, and deployed on AWS using Architect.

## Development Guidelines

### Code Style
- **Modular Design**: Keep files under 500 lines when possible
- **Environment Safety**: Never hardcode secrets or API keys
- **Test-First**: Write tests before implementation when applicable
- **Clean Architecture**: Separate concerns appropriately
- **Documentation**: Keep code comments and docs updated

### File Organization
- Source code: `app/`
- Tests: `tests/`
- Documentation: `docs/`
- Scripts: `scripts/`
- Blog posts: `posts/`

**Important**: Never save working files, text files, markdown files, or tests to the root folder. Always use appropriate subdirectories.

## Available Scripts

### Build Commands
- `npm run build` - Build project for production
- `npm run build:arc` - Build for Architect deployment
- `npm run dev` - Start development server
- `npm run dev:arc` - Start Architect sandbox

### Quality Checks
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking
- `npm run format` - Format code with Prettier
- `npm test` - Run tests

### Utilities
- `npm run compile:mdx` - Compile MDX blog posts
- `npm run analyze` - Analyze bundle size
- `npm run test:deploy` - Simulate Lambda deployment

## Tech Stack

- **Framework**: React Router 7
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Deployment**: AWS (Architect)
- **Package Manager**: npm

## Development Workflow

1. Make changes in feature branch
2. Run `npm run lint` and `npm run typecheck` locally
3. Ensure tests pass
4. Create pull request
5. CI/CD will run lint, typecheck, and deploy on merge to master

## Important Reminders

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files to creating new ones
- NEVER proactively create documentation files (*.md) or README files unless explicitly requested
- Never save working files, text/mds and tests to the root folder

## Active Technologies
- TypeScript 5.x (strict mode enabled), React 19, Node.js 22+, React Router 7, Tailwind CSS 4, Vite 6, AWS Architect (001-modernize-website)
- Redis (ioredis) for server-side state, LocalStorage for client persistence, S3 + CloudFront for assets/images; compiled MDX is bundled into the SSR build, not fetched (001-modernize-website)

## Code Standards (Modernization)

### Styling
- **Tailwind CSS Only**: No inline `style={{}}` objects - use Tailwind utility classes
- **Theme Fonts**: Use `font-neo` (Inter) for body text, `font-mono` (JetBrains Mono) for code blocks
- **Global CSS**: Minimal scope - most styling via Tailwind classes

### Component Structure
- **Export Pattern**: Default exports for components, named exports for hooks/utilities
- **TypeScript**: Explicit prop interfaces (e.g., `interface ButtonProps`)
- **File Size**: Target <500 lines (ESLint warns at 500)
- **Shared Components**: Extract patterns used in 2+ routes to `app/components/`

### File Organization
- Shared components: `app/components/` (PhotoGallery, Modal, Button, Card, etc.)
- Custom hooks: `app/hooks/` (useLocalStorage, useLightbox)
- Route files: `app/routes/` (keep focused on routing/data loading)
- Documentation: `docs/code-standards.md` for detailed patterns

### Testing
- Visual regression: Playwright (`npm run test:visual`)
- Unit tests: Vitest (`npm test`)
- Always maintain existing test coverage

## Deployment Architecture Notes

### Lambda zip: SSR build + handler + prod node_modules (no client assets)
The deployed Lambda (`server/`) contains the SSR build (`build/server/`, including the ~84 KB `posts.server` chunk of compiled MDX) plus the esbuilt `index.mjs` and prod `node_modules`. Client assets, fonts, and blog images are **not** in the Lambda — they're served **same-origin through CloudFront**: the asset bucket is an origin on the `tylerbarron.com` distribution (E1TUWNZL0WZZ6J) with `/assets/*`, `/fonts/*`, `/images/*` behaviors (CachingOptimized + brotli/gzip). `VITE_CDN_URL` is `https://tylerbarron.com`, and CI syncs the bucket in the "Publish assets + images to CDN bucket" step. The `/assets/*`, `/fonts/*`, `/images/*` static fallback in `server.ts` only runs in the local `arc sandbox` (`ARC_ENV !== 'production'`).

### Blog posts are bundled, not fetched from S3
`npm run compile:mdx` writes compiled posts to `app/posts/compiled/*.json` (gitignored). `app/utils/posts.server.ts` bundles them into the SSR build via `import.meta.glob` (prod) or compiles `posts/*.mdx` on the fly (dev, gated by `import.meta.env.DEV` so `mdx-bundler` is tree-shaken from prod). Image `src`s are rewritten to `VITE_CDN_URL` at compile time — so `compile:mdx` must run with that env set (CI Build step does). No runtime S3 fetch for posts.

### Lambda response size cap is 6 MB (effectively ~4.5 MB raw)
API Gateway rejects Lambda responses larger than 6 MB. Because the handler base64-encodes binary assets (~1.33× expansion), the practical raw-file limit is ~4.5 MB. Symptom of going over: HTTP 500 with body `{"message":"Internal Server Error"}` and `apigw-requestid` header. The Stockfish WASM (7.3 MB) hit this — now offloaded to unpkg CDN; see `app/utils/multipleChoiceChess/stockfishEngine.ts`.

### Lambda dependencies: two lists that must stay in sync
The Lambda installs `server/package.json` (a separate, hand-maintained list: the AWS preset, `chess.js`, `ioredis`, `isbot`, `react`, `react-dom`, `react-router`) — ~15 MB installed, dominated by `react-dom` (4.4 MB) and `react-router` (4 MB). **No `@aws-sdk` ships in the Lambda**; runtime AWS SDK usage is zero (`@aws-sdk/client-s3` is a devDependency used only by the upload scripts). The Vite SSR build externalizes all npm deps, so anything an SSR-rendered module imports must either be in `server/package.json` or listed in `ssr.noExternal` in `vite.config.ts` (currently `chessground`, `d3-geo`, `d3-array`, `topojson-client` — bundled tree-shaken into `build/server`). Getting this wrong 500s those routes **for bots/curl only** (`onAllReady` path); browsers recover client-side via `onShellReady`, so the breakage hides from casual testing (2026-06-10 incident). Audit after a build: `grep -rho 'from "[^"]*"' build/server/ | grep -v '"\./\|"node:' | sort -u` and compare against `server/package.json` (npm auto-installs the preset's peers `react-router` + `@react-router/node`).

### Versioning (automated semver in the footer)
Releases are **fully automated by semantic-release** (`.releaserc.json`), driven by [Conventional Commits](https://www.conventionalcommits.org): `fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major. Other types (`chore:`, `ci:`, `docs:`, `refactor:`, `perf:`, `test:`) don't release.

Flow: on push to `master`, the deploy job runs `npx semantic-release` **before** the build. It analyzes commits since the last tag, and if a release is warranted it bumps `package.json` on disk, writes `CHANGELOG.md`, and commits + tags `X.Y.Z` (prefix-less, `tagFormat: "${version}"`, matching the legacy `5.0.24` tag). The commit message carries `[skip ci]` to avoid re-triggering. The build then reads the bumped `package.json`. The GitHub Release object is created by a separate **non-blocking** `gh release create` step in `deploy.yml` (not `@semantic-release/github`): it's the only release action that would run after the tag is pushed but before the deploy, and a transient GitHub API failure there once aborted a deploy and left a tagged-but-undeployed state (2026-06-10 outage). If that step gets skipped by an outage, the Release for that tag stays missing (tags are the source of truth; semantic-release doesn't read Releases) — recreate it with `git log -1 --format=%b <tag> | gh release create <tag> --title <tag> --verify-tag --notes-file -`.

`package.json` `version` is the footer's source of truth: `vite.config.ts` injects it as `__APP_VERSION__` (and the short commit hash as `__GIT_COMMIT__`); `Footer.tsx` renders `v<version> · <hash>`. The deploy checkout uses `fetch-depth: 0` so semantic-release can see all tags/history. To cut a release you just push conventional commits — no manual version step. Validate locally with `GITHUB_TOKEN=$(gh auth token) npx semantic-release --dry-run --no-ci`.

Commit messages are enforced locally: a **Husky** `commit-msg` hook (`.husky/commit-msg`) runs **commitlint** (`.commitlintrc.json`, extends `@commitlint/config-conventional`) and rejects non-conventional messages. The hook installs via the `prepare` script on `npm install`; CI sets `HUSKY=0` so it never runs against semantic-release's own release commit.

## Recent Changes
- 001-modernize-website: Standardized Tailwind CSS patterns, decomposed large routes, unified typography system, enforced code standards via ESLint
