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
- **Build Tool**: Vite 6
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

- Node.js >= 22.0.0
- npm

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

### Standard Deployment

Run the production server:

```bash
npm start
```

### AWS Deployment

The application is configured for deployment to AWS using the Architect framework. The infrastructure is defined in `app.arc` and `preferences.arc`.

Deploy to AWS:
```bash
arc deploy
```

The app uses:
- AWS Lambda for serverless compute
- S3 for static asset storage
- CloudFront for CDN (configured via Architect)

## 🎨 Styling

The project uses:
- **Tailwind CSS 4** for utility-first styling with new `@theme` syntax
- **Custom typography** via `@tailwindcss/typography`
- **Berkeley Mono** font family for code and special text
- **Chessground CSS** for chess board styling

Configuration files:
- `app/styles/index.css` - Global styles with Tailwind 4 `@theme` configuration
- `postcss.config.js` - PostCSS plugins

## 📝 Adding Blog Posts

Blog posts are written in MDX format and stored in the `posts/` directory.

1. Create a new `.mdx` file in `posts/`
2. Add frontmatter with metadata (title, date, description, etc.)
3. Write content using Markdown with React components
4. Access at `/blog/[filename]`

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
- `prettier.config.cjs` - Prettier code formatting rules

