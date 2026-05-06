#!/usr/bin/env node
import { bundleMDX } from 'mdx-bundler';
import rehypeImgSize from 'rehype-img-size';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bake the production CDN base into compiled MDX so /images/* and /fonts/*
// references resolve directly to S3/CloudFront instead of routing through Lambda.
const CDN_BASE = (process.env.VITE_CDN_URL || process.env.CDN_URL || '')
  .replace(/\/$/, '')
  .replace(/\/images$/, '');

function rewriteAssetSrcs(code) {
  if (!CDN_BASE) return code;
  // Matches src:"/images/... or src:"/fonts/... in the bundled JSX output.
  return code.replace(/src:"\/(images|fonts)\//g, `src:"${CDN_BASE}/$1/`);
}

async function processMdx(source) {
  const result = await bundleMDX({
    source,
    mdxOptions(options) {
      options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkMath];
      options.rehypePlugins = [...(options.rehypePlugins ?? []), rehypeKatex];
      options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkGfm];
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        [rehypeImgSize, { dir: "public" }]
      ];
      return options;
    },
  });
  return { ...result, code: rewriteAssetSrcs(result.code) };
}

async function compileAllMdx() {
  const postsDir = path.join(__dirname, '..', 'posts');
  const outputDir = path.join(__dirname, '..', 'public', 'compiled-posts');
  
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

