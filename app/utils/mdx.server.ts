import { bundleMDX } from 'mdx-bundler';
import rehypeImgSize from 'rehype-img-size';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export async function processMdx(source: string) {
  const result = await bundleMDX({
    source,
    mdxOptions(options) {
      options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkMath, remarkGfm];
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        rehypeKatex,
        [rehypeImgSize, { dir: "public" }]
      ];
      return options;
    },
  });
  return result;
}