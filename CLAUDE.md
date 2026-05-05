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

### Lambda + API Gateway: everything goes through the Lambda
Despite `app.arc` declaring `@static folder public fingerprint true`, no CloudFront behavior currently routes static paths to the static S3 bucket. Every request hits API Gateway → Lambda. `server.ts` (lines ~31–65) detects `/assets/`, `/fonts/`, `/images/` paths, reads from `build/client/` on disk, base64-encodes, and returns. The static bucket (`tbwebsiteremixproduction-staticbucket-*`) does receive the files but nothing in front of CloudFront routes traffic to it.

### Lambda response size cap is 6 MB (effectively ~4.5 MB raw)
API Gateway rejects Lambda responses larger than 6 MB. Because the handler base64-encodes binary assets (~1.33× expansion), the practical raw-file limit is ~4.5 MB. Symptom of going over: HTTP 500 with body `{"message":"Internal Server Error"}` and `apigw-requestid` header. The Stockfish WASM (7.3 MB) hit this — now offloaded to unpkg CDN; see `app/utils/multipleChoiceChess/stockfishEngine.ts`.

### When cutting Lambda size: the real win is bypassing it for static assets
The Lambda bundle itself is ~500 KB; the weight comes from `build/client/` being read at runtime. To genuinely shrink the deploy and remove the response-size constraint, configure CloudFront behaviors so `/assets/*`, `/fonts/*`, `/images/*` route directly to the static S3 bucket (already populated by `build:arc:assets`) and only dynamic routes hit the Lambda. The `@ballatech/react-router7-preset-aws` preset doesn't currently set this up — would require Architect/CloudFormation customization.

## Recent Changes
- 001-modernize-website: Standardized Tailwind CSS patterns, decomposed large routes, unified typography system, enforced code standards via ESLint
