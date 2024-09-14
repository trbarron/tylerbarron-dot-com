import { json } from '@remix-run/node';
import { useLoaderData, Link } from '@remix-run/react';
import fs from 'fs/promises';
import path from 'path';

export async function loader() {
  const postsPath = path.join(process.cwd(), 'posts');
  const files = await fs.readdir(postsPath);
  const posts = files.map(filename => ({
    slug: filename.replace('.mdx', ''),
    title: filename.replace('.mdx', '').split('-').join(' ')
  }));
  return json({ posts });
}

export default function BlogIndex() {
  const { posts } = useLoaderData<typeof loader>();

  return (
    <div>
      <h1>Blog Posts</h1>
      <ul>
        {posts.map((post) => (
          <li key={post.slug}>
            <Link to={post.slug}>{post.title}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}