import { useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { getMDXComponent } from 'mdx-bundler/client/index.js';
import { useMemo } from 'react';
import { processMdx } from '~/utils/mdx.server';
import fs from 'fs/promises';
import path from 'path';
import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const { slug } = params;
  
  console.log('Blog loader - Environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
    isProduction: process.env.NODE_ENV === 'production',
    slug
  });
  
  if (process.env.NODE_ENV === 'production') {
    const region = process.env.AWS_REGION || 'us-west-2';
    const bucketName = process.env.AWS_BUCKET_NAME || 'remix-website-writing-posts';
    
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({ region: region });
 
    try {
      const { Body } = await s3.send(new GetObjectCommand({
        Bucket: bucketName,
        Key: `posts/${slug}.mdx`
      }));
      
      if (!Body) {
        throw new Response('Not Found', { status: 404 });
      }
      
      const source = await Body.transformToString();
      const { code, frontmatter } = await processMdx(source);
      return Response.json({ code, frontmatter });
    } catch (error) {
      console.error('S3 Error:', error);
      throw new Response('Not Found', { status: 404 });
    }
  } else {
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

  const Component = useMemo(() => getMDXComponent(code), [code]);

  return (
    <div className="min-h-screen bg-white font-neo">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <article className="max-w-4xl mx-auto mb-8">
          <header className="mb-8 pb-8">
            <h1 className="text-5xl lg:text-6xl font-extrabold text-black mb-6 font-neo tracking-tight leading-none text-center">
              {frontmatter.title.toUpperCase()}
            </h1>
            <div className="text-black font-neo font-semibold text-lg tracking-wide text-center mb-6">
              {new Date(frontmatter.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }).toUpperCase()}
            </div>
            <div className="border-t-4 border-black w-full"></div>
          </header>

          <div className="mx-auto prose prose-lg max-w-none
                          tracking-normal
                          prose-headings:font-neo prose-headings:font-extrabold prose-headings:text-black prose-headings:uppercase prose-headings:tracking-tight
                          prose-headings:border-b-2 prose-headings:border-accent prose-headings:pb-2
                          prose-p:font-neo prose-p:text-black prose-p:leading-relaxed prose-p:font-medium prose-p:text-lg
                          prose-a:text-black prose-a:no-underline prose-a:border-b-2 prose-a:border-black prose-a:pb-0.5 prose-a:font-semibold
                          prose-a:transition-all prose-a:duration-100
                          hover:prose-a:bg-accent hover:prose-a:text-white hover:prose-a:border-accent
                          hover:prose-a:px-1 hover:prose-a:-mx-1
                          prose-li:font-neo prose-li:text-black prose-li:font-medium prose-li:text-lg prose-li:my-1
                          prose-ul:font-neo prose-ul:text-black prose-ul:ml-6 prose-ul:my-4 prose-ul:list-disc prose-ul:pl-2
                          prose-ol:font-neo prose-ol:text-black prose-ol:ml-6 prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-2
                          prose-code:bg-gray-100 prose-code:text-black prose-code:border prose-code:border-black prose-code:font-mono
                          prose-code:before:content-none prose-code:after:content-none
                          prose-code:px-1 prose-code:py-0.5
                          prose-pre:bg-gray-100 prose-pre:text-black prose-pre:border-2 prose-pre:border-black prose-pre:font-mono
                          prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-gray-100 prose-blockquote:font-neo
                          prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:font-semibold prose-blockquote:text-lg prose-blockquote:not-italic
                          prose-blockquote:before:content-none prose-blockquote:after:content-none
                          prose-img:border-2 prose-img:border-black prose-img:transition-all
                          prose-table:border-2 prose-table:border-black prose-table:font-neo prose-table:bg-white prose-table:font-medium
                          prose-th:bg-black prose-th:text-white prose-th:border prose-th:border-black prose-th:font-bold prose-th:uppercase
                          prose-td:border prose-td:border-black prose-td:px-2 prose-td:py-1
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