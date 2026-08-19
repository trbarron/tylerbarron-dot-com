# Tyler Barron's Personal Website

A full-stack web application showcasing various projects, interactive applications, and blog posts. Built with modern web technologies including React Router 7, TypeScript, and Tailwind CSS.

🌐 **Live Site**: [tylerbarron.com](https://tylerbarron.com)

## 🚀 Tech Stack

- **Framework**: [React Router 7](https://reactrouter.com/)
- **UI Library**: React 19
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 with custom typography plugin
- **Content**: MDX for blog posts with remark/rehype plugins
- **Chess UI**: Chessground library
- **Data Visualization**: D3.js for maps and charts
- **Lightbox**: yet-another-react-lightbox for image galleries
- **Infrastructure**: AWS (Architect Framework, Lambda, S3)
- **Build Tool**: Vite 8
- **Package Manager**: npm

## 📁 Project Structure

```
tylerbarron-dot-com/
├── app/
│   ├── components/        # Reusable React components
│   ├── routes/           # Route handlers and pages
│   ├── styles/           # Global CSS and Chessground themes
│   ├── utils/            # Utility functions (MDX processing, etc.)
│   └── types/            # TypeScript type definitions
├── posts/                # MDX blog posts
├── public/               # Static assets (images, fonts)
├── server/               # Production server build
└── build/                # Build output
```

## 🛠️ Development

### Prerequisites

- Node.js >= 24.0.0
- npm

### 🖼️ Managing Images

Images live in an S3 bucket served same-origin through CloudFront (`https://tylerbarron.com/images/...`).

**To add new images:**

1. Place them in `app/images/`.
2. Run the upload script:
   ```bash
   npm run deploy:images
   ```
3. Use them in your code:
   ```ts
   import { getImageUrl } from "~/utils/cdn";
   const myImage = getImageUrl("Folder/image.jpg");
   ```

### Getting Started

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Run the development server**:

   ```bash
   npm run dev
   ```

3. **Type checking**:

   ```bash
   npm run typecheck
   ```

4. **Linting**:

   ```bash
   npm run lint
   ```

5. **Code formatting**:

   ```bash
   npm run format
   ```

6. **Tests**:

   ```bash
   npm test          # Vitest unit + integration suite
   npm run test:watch
   ```

   Playwright visual-regression specs live under `tests/visual/` and run
   separately via `npm run test:visual`. They are not part of CI, and their
   snapshots need regenerating (`npm run test:visual:baseline`) after any
   deliberate change to fonts, colours, or layout — otherwise they fail for
   the wrong reason.

### Development with AWS (Architect)

To develop with the AWS Architect sandbox:

```bash
npm run dev:arc
```

This builds the application and runs it in a local AWS environment simulation.

## 📦 Building for Production

Build the application:

```bash
npm run build
```

This generates:

- `build/client/` - Client-side assets
- `build/server/` - Server-side code

### AWS Deployment

Build for AWS Lambda deployment:

```bash
npm run build:arc
```

This command:

1. Builds the React Router app
2. Copies client assets to `public/`
3. Bundles the server code with esbuild
4. Prepares the deployment package in `server/`

## 🚢 Deployment

### Running the production build locally

The deployed app is a Lambda behind API Gateway, so the way to exercise a
production build locally is the Architect sandbox — it runs the real handler:

```bash
npm run dev:arc          # builds, then serves on http://localhost:8811
```

This is also the only local setup that reproduces the SSR externalization
boundary, so it's what to use when checking that routes render for bots:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -A 'Googlebot' http://localhost:8811/
```

### AWS Deployment

Deploys are automated: pushing to `master` runs lint + typecheck, then semantic-release
(Conventional Commits drive the version in the footer) and `arc deploy` via GitHub
Actions (`.github/workflows/deploy.yml`). There is no manual deploy step in normal use.

The infrastructure is defined in `app.arc` and `preferences.arc`. The app uses:

- AWS Lambda (via Architect) for SSR compute behind API Gateway
- S3 for static assets, fonts, and blog images
- CloudFront serving everything same-origin at tylerbarron.com — API Gateway as the
  default origin, the asset bucket behind `/assets/*`, `/fonts/*`, `/images/*`
  behaviors (compressed + edge-cached)

## 🎨 Styling

The project uses:

- **Tailwind CSS 4** for utility-first styling with new `@theme` syntax
- **Custom typography** via `@tailwindcss/typography`
- **Inter** for body text (`font-neo`) and **IBM Plex Mono** for code (`font-mono`) —
  both self-hosted from `public/fonts/` under the SIL Open Font License. Note that
  Tailwind's default `font-sans` is not used.
- **Chessground CSS** for chess board styling

Configuration files:

- `app/styles/index.css` - Global styles with Tailwind 4 `@theme` configuration
- `vite.config.ts` - Vite config; Tailwind runs through @tailwindcss/vite (no PostCSS step)

## 📝 Adding Blog Posts

Blog posts are written in MDX format and stored in the `posts/` directory.

1. Create a new `.mdx` file in `posts/`
2. Add frontmatter with metadata (title, date, description, etc.)
3. Write content using Markdown with React components
4. Generate the OG share card and commit it:
   ```bash
   python3 scripts/generate-og-image.py    # writes public/images/og/<slug>.png
   ```
   **This step is not optional** — the CI `og-cards` job fails the build if a
   post has no card, or if the card was rendered from stale frontmatter.
   Verify locally with `npm run check:og`.
5. Access at `/blog/[filename]`

Everything else — the homepage list, sitemap, RSS feed, and prev/next navigation —
is derived automatically.

Post images go in `public/images/posts/<slug>/` and are referenced as
`/images/posts/<slug>/<file>`. CI fails on a missing or case-mismatched
reference, since S3 is case-sensitive and macOS is not.

Supported features:

- Math equations (KaTeX)
- Syntax highlighting
- GitHub Flavored Markdown
- Custom React components

## 🔧 Configuration Files

- `vite.config.ts` - Vite build configuration
- `react-router.config.ts` - React Router configuration
- `tsconfig.json` - TypeScript compiler options
- `app.arc` - AWS Architect infrastructure definition
- `prettier.config.mjs` - Prettier code formatting rules
