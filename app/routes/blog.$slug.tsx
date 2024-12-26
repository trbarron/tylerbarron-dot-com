import { json } from '@remix-run/node';
import type { LoaderFunction } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import { getMDXComponent } from 'mdx-bundler/client/index.js';
import { useMemo } from 'react';
import { processMdx } from '~/utils/mdx.server';
import fs from 'fs/promises';
import path from 'path';

export const loader: LoaderFunction = async ({ params }) => {
  const { slug } = params;
  const rootDir = path.dirname(process.cwd());
  const filePath = path.join(rootDir, 'app', 'posts', `${slug}.mdx`);
  
  try {
    const source = await fs.readFile(filePath, 'utf-8');
    const { code, frontmatter } = await processMdx(source);
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link 
        to="/blog" 
        className="mb-8 inline-block"
      >
        ← Back to posts
      </Link>
      
      <article className="prose lg:prose-xl dark:prose-invert prose-slate mx-auto">
        {/* Header section */}
        <header className="mb-8">
          <h1 className="text-4xl mb-4">{frontmatter.title}</h1>
          <div className="text-gray-600 dark:text-gray-400 ml-4">
            Published on{' '}
            {new Date(frontmatter.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </div>
          {frontmatter.tags && (
            <div className="flex gap-2 mt-4">
              {frontmatter.tags.map((tag: string) => (
                <span 
                  key={tag}
                  className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 
                           rounded-full px-3 py-1 text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* Main content */}
        <div className="prose-headings:tracking-tight
                      prose-a:no-underline hover:prose-a:underline
                      prose-img:rounded-lg prose-img:shadow-md">
          <Component />
        </div>
      </article>
      
      {/* Footer section */}
      <footer className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-800">
        <div className="text-gray-600 dark:text-gray-400 text-sm">
          {frontmatter.author && (
            <p>Written by {frontmatter.author}</p>
          )}
          <p className="mt-2">
            Have questions or feedback? Find me on{' '}
            <a href="https://bsky.app/profile/tbarron.bsky.social" 
               className="hover:underline">
              Bluesky
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}