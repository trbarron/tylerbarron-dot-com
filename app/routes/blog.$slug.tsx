import { useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { useMemo } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";

// Inline MDX component evaluator (replaces getMDXComponent from mdx-bundler/client)
function getMDXComponent(code: string) {
  const scope = {
    React,
    ReactDOM,
    _jsx_runtime: jsxRuntime,
  };
  const fn = new Function(...Object.keys(scope), code);
  return fn(...Object.values(scope)).default;
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { slug } = params;
  
  // Use ARC_ENV (automatically set by Architect) to detect production
  const isProduction = process.env.ARC_ENV === 'production';
  
  if (isProduction) {
    // In production, fetch pre-compiled JSON from S3
    const region = 'us-west-2'; // Hardcode since it matches app.arc
    const bucketName = process.env.AWS_BUCKET_NAME || 'remix-website-writing-posts';
    
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: region });
 
    try {
      const { Body } = await s3.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: `compiled-posts/${slug}.json`
      }));
      
      if (!Body) {
        throw new Response('Not Found', { status: 404 });
      }
      
      const jsonString = await Body.transformToString();
      const { code, frontmatter } = JSON.parse(jsonString);
      return Response.json({ code, frontmatter });
    } catch (error) {
      console.error('S3 Error:', error);
      throw new Response('Not Found', { status: 404 });
    }
  } else {
    // In development, compile on the fly for better DX
    // Dynamic imports to avoid bundling mdx-bundler in production
    const [{ processMdx }, fs, path] = await Promise.all([
      import('~/utils/mdx.server'),
      import('fs/promises'),
      import('path')
    ]);
    
    const filePath = path.join(process.cwd(), '..', 'posts', `${slug}.mdx`);
    try {
      const source = await fs.readFile(filePath, 'utf-8');
      const { code, frontmatter } = await processMdx(source);
      return Response.json({ code, frontmatter });
    } catch (error) {
      console.error('Filesystem Error:', error);
      throw new Response('Not Found', { status: 404 });
    }
  }
};

export default function BlogPost() {
  const { code, frontmatter } = useLoaderData<typeof loader>();

  // Use getMDXComponent from mdx-bundler/client
  const Component = useMemo(() => getMDXComponent(code), [code]);

  return (
    <div className="min-h-screen bg-white dark:bg-black font-neo">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <article className="max-w-4xl mx-auto mb-8">
          <header className="mb-8 pb-8">
            <h1 className="text-5xl lg:text-6xl font-extrabold text-black dark:text-white mb-6 font-neo tracking-tight leading-none text-center">
              {frontmatter.title.toUpperCase()}
            </h1>
            <div className="text-black dark:text-white font-neo font-semibold text-lg tracking-wide text-center mb-6">
              {new Date(frontmatter.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }).toUpperCase()}
            </div>
            <div className="border-t-4 border-black dark:!border-white w-full"></div>
          </header>

          <div className="mx-auto prose prose-lg max-w-none
                          tracking-normal
                          prose-headings:font-neo prose-headings:font-extrabold prose-headings:text-black dark:prose-headings:text-white prose-headings:uppercase prose-headings:tracking-tight
                          prose-headings:border-b-2 prose-headings:border-accent prose-headings:pb-2
                          prose-p:font-neo prose-p:text-black dark:prose-p:text-white prose-p:leading-relaxed prose-p:font-medium prose-p:text-lg
                          prose-a:text-black dark:prose-a:text-white prose-a:no-underline prose-a:border-b-2 prose-a:border-black dark:prose-a:!border-white prose-a:pb-0.5 prose-a:font-semibold
                          prose-a:transition-all prose-a:duration-100
                          hover:prose-a:bg-accent dark:hover:prose-a:bg-accent hover:prose-a:text-white hover:prose-a:border-accent
                          hover:prose-a:px-1 hover:prose-a:-mx-1
                          prose-li:font-neo prose-li:text-black dark:prose-li:text-white prose-li:font-medium prose-li:text-lg prose-li:my-1
                          prose-ul:font-neo prose-ul:text-black dark:prose-ul:text-white prose-ul:ml-6 prose-ul:my-4 prose-ul:list-disc prose-ul:pl-2
                          prose-ol:font-neo prose-ol:text-black dark:prose-ol:text-white prose-ol:ml-6 prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-2
                          prose-code:bg-gray-100 dark:prose-code:bg-black prose-code:text-black dark:prose-code:text-white prose-code:border prose-code:border-black dark:prose-code:!border-white prose-code:font-mono
                          prose-code:before:content-none prose-code:after:content-none
                          prose-code:px-1 prose-code:py-0.5
                          prose-pre:bg-gray-100 dark:prose-pre:bg-black prose-pre:text-black dark:prose-pre:text-white prose-pre:border-2 prose-pre:border-black dark:prose-pre:!border-white prose-pre:font-mono
                          prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-gray-100 dark:prose-blockquote:bg-black prose-blockquote:font-neo
                          prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:font-semibold prose-blockquote:text-lg prose-blockquote:not-italic
                          prose-blockquote:before:content-none prose-blockquote:after:content-none
                          prose-img:border-2 prose-img:border-black dark:prose-img:!border-white prose-img:transition-all
                          prose-table:border-2 prose-table:border-black dark:prose-table:!border-white prose-table:font-neo prose-table:bg-white dark:prose-table:bg-black prose-table:font-medium
                          prose-th:bg-black dark:prose-th:bg-black prose-th:text-white prose-th:border prose-th:border-black dark:prose-th:!border-white prose-th:font-bold prose-th:uppercase
                          prose-td:border prose-td:border-black dark:prose-td:!border-white prose-td:px-2 prose-td:py-1
                          ">
            <Component />
          </div>
        </article>
        
        {/* Footer section with reduced spacing */}
        <div className="mt-12">
          <Footer />
        </div>
      </div>
    </div>
  );
}