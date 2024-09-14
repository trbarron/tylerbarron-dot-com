import { json } from '@remix-run/node';
import type { LoaderFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { getMDXComponent } from 'mdx-bundler/client';
import { useMemo } from 'react';
import { processMdx } from '~/utils/mdx.server';
import YouTubeEmbed from '~/components/YouTubeEmbed';
import fs from 'fs/promises';
import path from 'path';

export const loader: LoaderFunction = async ({ params }) => {
  const { slug } = params;
  const filePath = path.join(process.cwd(), 'posts', `${slug}.mdx`);
  
  try {
    console.log(`Attempting to read file: ${filePath}`);
    const source = await fs.readFile(filePath, 'utf-8');
    console.log('File read successfully');
    const { code, frontmatter } = await processMdx(source);
    console.log('MDX processed successfully');
    return json({ code, frontmatter });
  } catch (error) {
    console.error('Error in loader:', error);
    throw new Response('Not Found', { status: 404 });
  }
};

export default function BlogPost() {
  const { code, frontmatter } = useLoaderData();
  const Component = useMemo(() => getMDXComponent(code), [code]);

  return (
    <article className="prose lg:prose-xl mx-auto">
      <h1>{frontmatter.title}</h1>
      <p>Published on: {frontmatter.date}</p>
      <Component components={{ YouTubeEmbed }} />
    </article>
  );
}