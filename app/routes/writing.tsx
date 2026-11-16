import { useLoaderData } from 'react-router';
import { Navbar } from '~/components/Navbar';
import Footer from '~/components/Footer';
import { PostsByYear } from '~/components/PostList';
import { buildMeta } from '~/utils/seo';

export function meta() {
  return buildMeta({ title: 'Writing', description: 'Every post, by year.', path: '/writing' });
}

export async function loader() {
  const { getAllPostMeta } = await import('~/utils/posts.server');
  const posts = await getAllPostMeta();
  return { posts: posts.filter((p) => p.type !== 'project').map(({ slug, title, date }) => ({ slug, title, date })) };
}

export default function Writing() {
  const { posts } = useLoaderData<typeof loader>();
  return (
    <>
      <Navbar />
      <main className="font-neo relative z-10 flex w-full justify-center py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-0 left-1/2 z-0 w-[min(100%,1024px)] -translate-x-1/2 bg-white"
        />
        <div className="relative z-10 flex w-full max-w-5xl flex-col items-center px-8">
          <h1 className="font-neo mb-12 inline-block border-b-8 border-black bg-white px-4 pb-2 text-4xl font-extrabold tracking-tighter text-black uppercase lg:text-5xl">
            WRITING
          </h1>
          <PostsByYear posts={posts} />
        </div>
      </main>
      <Footer />
    </>
  );
}

// Same HTML for everyone until the next deploy, so CloudFront may serve it.
export { cachedPageHeaders as headers } from '~/utils/cache';
