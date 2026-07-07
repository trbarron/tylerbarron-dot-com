import { bundleMDX } from 'mdx-bundler';
import rehypeImgSize from 'rehype-img-size';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypePrettyCode from 'rehype-pretty-code';

export async function processMdx(source: string) {
  const result = await bundleMDX({
    source,
    mdxOptions(options) {
      options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkMath, remarkGfm];
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        rehypeKatex,
        // Keep options in sync with scripts/compile-mdx.mjs (prod compile path).
        [rehypePrettyCode, { theme: 'github-light', keepBackground: false }],
        [rehypeImgSize, { dir: "public" }]
      ];
      return options;
    },
  });
  return result;
}