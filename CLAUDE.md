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
- TypeScript 5.x (strict mode enabled), React 19, Node.js 22+ + React Router 7 (v7.9.0), Tailwind CSS 4, Vite 6, AWS Architec (001-modernize-website)
- Redis (ioredis) for server-side state, LocalStorage for client persistence, S3 for compiled MDX/images (001-modernize-website)

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

### Lambda zip: SSR build + handler + prod node_modules only
The deployed Lambda (`server/`) is ~35 MB, of which ~34 MB is `node_modules` (`@aws-sdk` and `@smithy` alone are ~18 MB). It does NOT contain `build/client/` — images/fonts are not bundled. The static-file fallback in `server.ts` only fires under `arc sandbox` (it's gated on `ARC_ENV !== 'production'`).

### Static assets are served from S3 directly
`/images/*` (and `/fonts/*`) resolve to `VITE_CDN_URL` / `CDN_URL` — currently `https://remix-website-writing-posts.s3.us-west-2.amazonaws.com`. Two mechanisms keep paths off the Lambda:
1. **Compiled MDX**: `scripts/compile-mdx.mjs` rewrites `src:"/images/..."` → `src:"${CDN_BASE}/images/..."` at build time (env loaded via `--env-file-if-exists=.env`).
2. **App code**: use `app/utils/cdn.ts` (`getImageUrl`, `image`) — never hardcode `/images/...` in TSX.

Anything that still ships a raw `/images/...` path to the browser will hit the Lambda and 404.

### Lambda response size cap is 6 MB (effectively ~4.5 MB raw)
API Gateway rejects Lambda responses larger than 6 MB. Because the handler base64-encodes binary assets (~1.33× expansion), the practical raw-file limit is ~4.5 MB. Symptom of going over: HTTP 500 with body `{"message":"Internal Server Error"}` and `apigw-requestid` header. The Stockfish WASM (7.3 MB) hit this — now offloaded to unpkg CDN; see `app/utils/multipleChoiceChess/stockfishEngine.ts`.

### When cutting Lambda size further: target node_modules
With static assets already off-Lambda, the remaining bloat is server `node_modules`. Top offenders: `@aws-sdk` (10 MB) + `@smithy` (7.7 MB), then `react-dom` (4.4 MB) and `react-router` (4 MB). The esbuild step in `build:arc:server` already externalizes `@aws-sdk/*` from `index.mjs`, but they're still installed by `build:arc:deps` because the AWS preset/server code requires them at runtime. Pruning unused AWS SDK clients (only `client-s3` and `client-dynamodb` are used) would be the next big win.

## Recent Changes
- 001-modernize-website: Standardized Tailwind CSS patterns, decomposed large routes, unified typography system, enforced code standards via ESLint
