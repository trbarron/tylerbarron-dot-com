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
  
  if (process.env.NODE_ENV === 'production') {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: process.env.AWS_REGION });
 
    try {
      const { Body } = await s3.send(new GetObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: `posts/${slug}.mdx`
      }));
      
      const source = await Body.transformToString();
      const { code, frontmatter } = await processMdx(source);
      return json({ code, frontmatter });
    } catch (error) {
      console.error('S3 Error:', error);
      throw new Response('Not Found', { status: 404 });
    }
  } else {
    const filePath = path.join(process.cwd(), '..', 'posts', `${slug}.mdx`);
    try {
      const source = await fs.readFile(filePath, 'utf-8');
      const { code, frontmatter } = await processMdx(source);
      return json({ code, frontmatter });
    } catch (error) {
      console.error('Filesystem Error:', error);
      throw new Response('Not Found', { status: 404 });
    }
  }
 };

export default function BlogPost() {
  const { code, frontmatter } = useLoaderData();
  const Component = useMemo(() => getMDXComponent(code), [code]);

  return (
    <div className="bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 bg-white">
        <Link 
          to="/blog" 
          className="mb-8 inline-block"
        >
          ← Back to posts
        </Link>
        
        <article className="max-w-4xl mx-auto">
          {/* Header section - outside of prose context */}
          <header className="mb-8">
            <h1 className="text-3xl mb-4 text-gray-dark font-light">{frontmatter.title}</h1>
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

          {/* Main content - single prose context */}
          <div className="mx-auto prose
                          prose-lg:prose-xl
                          tracking-tight
                          dark:prose-invert
                          prose-neutral
                          prose-headings:tracking-tight
                          prose-a:no-underline hover:prose-a:underline
                          prose-img:rounded-lg prose-img:shadow-md
                          prose-headings:text-red-clear
                          prose-headings:font-normal
                          prose-headings:text-3xl
                          prose-text:text-lg
                          prose-li:text-gray-500
                          prose-li:ml-8
                          prose-ul:text-gray-500
                          prose-ul:ml-8
                          prose-code:bg-gray-100 dark:prose-code:bg-green-800
                          prose-code:before:content-none prose-code:after:content-none
                          prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm
                          prose-code:font-mono prose-code:font-light
                          prose-a:underline prose-a:hover:no-underline
                          prose-a:text-green-800 prose-a:hover:text-green-900
                          ">
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
              {' '} or {' '}
              <a href="https://x.com/BuildABarr" 
                className="hover:underline">
                X, the everything app
              </a>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}