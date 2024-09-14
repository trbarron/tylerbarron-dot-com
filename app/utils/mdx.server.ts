import { bundleMDX } from 'mdx-bundler';
import rehypeHighlight from 'rehype-highlight';
import rehypeImgSize from 'rehype-img-size';
import remarkGfm from 'remark-gfm';

export async function processMdx(source: string) {
  const result = await bundleMDX({
    source,
    mdxOptions(options) {
      options.remarkPlugins = [...(options.remarkPlugins ?? []), remarkGfm];
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        rehypeHighlight,
        [rehypeImgSize, { dir: "public" }]
      ];
      return options;
    },
  });
  return result;
}