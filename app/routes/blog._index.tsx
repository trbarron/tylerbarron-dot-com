import { json } from '@remix-run/node';
import { Link, useLoaderData } from '@remix-run/react';
import fs from 'fs/promises';
import path from 'path';
import { processMdx } from '~/utils/mdx.server';

export async function loader() {
  // Get the directory path
  const postsPath = path.join(process.cwd(), '..', 'posts');
  console.log('Posts path:', postsPath);
  
  try {
    // Read all files in the posts directory
    const files = await fs.readdir(postsPath);
    const mdxFiles = files.filter(file => file.endsWith('.mdx'));
    
    // Process each MDX file to get its frontmatter
    const posts = await Promise.all(
      mdxFiles.map(async (filename) => {
        const filePath = path.join(postsPath, filename);
        const source = await fs.readFile(filePath, 'utf-8');
        const { frontmatter } = await processMdx(source);
        
        return {
          slug: filename.replace('.mdx', ''),
          title: frontmatter.title,
          date: frontmatter.date,
        };
      })
    );
    
    // Sort posts by date (most recent first)
    posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return json({ posts });
  } catch (error) {
    console.error('Error loading blog posts:', error);
    return json({ posts: [] });
  }
}

export default function Blog() {
  const { posts } = useLoaderData<typeof loader>();
  
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-3xl mb-8">Writing</h1>
      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.slug} className="border-b pb-4">
            <Link 
              to={post.slug} 
              className="text-xl hover:underline"
            >
              {post.title}
            </Link>
            <div className="text-gray-600 mt-1">
              {new Date(post.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}