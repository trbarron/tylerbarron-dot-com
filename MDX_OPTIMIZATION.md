# MDX Pre-compilation Optimization

## Summary

Successfully reduced Lambda function size from **61.5MB to 35MB** (43% reduction) by pre-compiling MDX blog posts at build time instead of runtime.

## What Changed

### Before
- MDX files were compiled **at runtime** in the Lambda
- `mdx-bundler` (~20-30MB) and related packages loaded in Lambda
- Every blog post request triggered MDX compilation
- Slower response times due to compilation overhead

### After
- MDX files are **pre-compiled at build time**
- Compiled JSON stored in S3 (`compiled-posts/` directory)
- Lambda only fetches and returns pre-compiled code
- Faster response times (no compilation overhead)
- Smaller Lambda bundle

## Files Created

### `scripts/compile-mdx.mjs`
Build script that:
- Reads all `.mdx` files from `posts/` directory
- Compiles each using `mdx-bundler` with plugins (KaTeX, GFM, etc.)
- Outputs compiled JSON to `public/compiled-posts/`
- Each JSON contains `code` and `frontmatter`

## Files Modified

### `app/routes/blog.$slug.tsx`
- **Production**: Fetches pre-compiled JSON from S3 (`compiled-posts/${slug}.json`)
- **Development**: Still compiles on-the-fly for better DX

### `server/package.json`
**Removed** (moved to devDependencies):
- `mdx-bundler` (~20-30MB with esbuild)
- `rehype-katex`
- `rehype-img-size`
- `remark-gfm`
- `remark-math`

These are now only installed during build, not in Lambda.

**Kept** (needed for SSR):
- `chessground` - Used in chess routes, imported during SSR
- `yet-another-react-lightbox` - Used in gallery routes, imported during SSR

### `package.json`
- Added `compile:mdx` script
- Updated `build:arc` to include MDX compilation step

### `.github/workflows/deploy.yml`
Updated `upload` job to:
1. Install dependencies
2. Compile MDX files
3. Upload compiled JSON to S3 (`compiled-posts/` directory)

### `.gitignore`
Added `/public/compiled-posts` to ignore generated files

## Size Comparison

| Component | Before | After |
|-----------|--------|-------|
| **Total Lambda** | **61.5MB** | **35MB** |
| Dependencies | ~57MB | ~34MB |
| SSR Build | ~4MB | ~236KB |
| Handler | ~100KB | ~88KB |

**Key Savings:**
- Removed `mdx-bundler` and MDX plugins: ~23MB
- SSR build optimization: ~3.7MB

## Performance Benefits

1. **Faster cold starts**: Smaller Lambda = faster initialization
2. **Faster blog loads**: No compilation = instant response
3. **Lower costs**: Less memory/CPU usage per request
4. **Better caching**: Pre-compiled code can be CDN cached

## Usage

### Local Development
```bash
# Compile MDX files
npm run compile:mdx

# Test Lambda size
npm run test:deploy
```

### Production Deployment
MDX compilation happens automatically in GitHub Actions before deployment.

## Further Optimization Ideas

To get closer to the 5MB ideal:

1. **Externalize React/ReactDOM**: Use Lambda Layers
2. **Code splitting**: Split by route in SSR build
3. **Tree shaking**: Audit and remove unused dependencies
4. **AWS SDK v3**: Use specific clients only (already done)
5. **Remove unused features**: Audit chess.js, d3-geo, etc.

## Notes

- Development mode still compiles on-the-fly (no changes needed)
- S3 bucket structure: `compiled-posts/*.json` (not `posts/*.mdx`)
- Compiled files are JSON: `{ code: string, frontmatter: object }`

