#!/usr/bin/env node
import { bundleMDX } from 'mdx-bundler';
import rehypeImgSize from 'rehype-img-size';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypePrettyCode from 'rehype-pretty-code';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeCdnBase, rewriteAssetSrcs } from './lib/rewriteAssetSrcs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bake the production CDN base into compiled MDX so /images/* and /fonts/*
// references resolve directly to S3/CloudFront instead of routing through Lambda.
const CDN_BASE = computeCdnBase();

async function processMdx(source) {
  const result = await bundleMDX({
    source,
    mdxOptions(options) {
      options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkMath];
      options.rehypePlugins = [...(options.rehypePlugins ?? []), rehypeKatex];
      options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkGfm];
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        // Shiki highlighting at compile time; keepBackground off so the
        // prose-pre styles control the block background. Untagged fences
        // (ASCII diagrams) are left untouched.
        [rehypePrettyCode, { theme: 'github-light', keepBackground: false }],
        [rehypeImgSize, { dir: "public" }]
      ];
      return options;
    },
  });
  return { ...result, code: rewriteAssetSrcs(result.code, CDN_BASE) };
}

async function compileAllMdx() {
  const postsDir = path.join(__dirname, '..', 'posts');
  // Output into the app module graph so Vite bundles the compiled posts into
  // the SSR build (via import.meta.glob in app/utils/posts.server.ts). No S3.
  const outputDir = path.join(__dirname, '..', 'app', 'posts', 'compiled');
  
  console.log('📝 Compiling MDX files...');
  console.log(`   Posts directory: ${postsDir}`);
  console.log(`   Output directory: ${outputDir}`);
  
  // Create output directory if it doesn't exist
  await fs.mkdir(outputDir, { recursive: true });
  
  // Read all MDX files
  const files = await fs.readdir(postsDir);
  const mdxFiles = files.filter(file => file.endsWith('.mdx'));
  
  console.log(`   Found ${mdxFiles.length} MDX files`);
  
  // Process each file
  for (const file of mdxFiles) {
    const slug = file.replace('.mdx', '');
    const filePath = path.join(postsDir, file);
    
    console.log(`   ⚙️  Compiling ${slug}...`);
    
    try {
      const source = await fs.readFile(filePath, 'utf-8');
      const { code, frontmatter } = await processMdx(source);

      // Per-post OG share card (scripts/generate-og-image.py). Only reference
      // it when the PNG actually exists so meta never points at a 404.
      const ogPath = path.join(__dirname, '..', 'public', 'images', 'og', `${slug}.png`);
      const hasOgImage = await fs.access(ogPath).then(() => true, () => false);
      if (hasOgImage) {
        frontmatter.ogImage = `/images/og/${slug}.png`;
      } else {
        console.warn(`   ⚠️  ${slug} has no OG card (falls back to the default) — run: python3 scripts/generate-og-image.py`);
      }

      // Write compiled output as JSON
      const outputPath = path.join(outputDir, `${slug}.json`);
      await fs.writeFile(
        outputPath,
        JSON.stringify({ code, frontmatter }, null, 2)
      );
      
      console.log(`   ✅ Compiled ${slug}`);
    } catch (error) {
      console.error(`   ❌ Error compiling ${slug}:`, error);
      process.exit(1);
    }
  }
  
  console.log(`\n✨ Successfully compiled ${mdxFiles.length} MDX files!`);
}

compileAllMdx().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

