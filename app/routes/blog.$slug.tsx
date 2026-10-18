import { Link, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs, MetaFunction } from 'react-router';
import { buildMeta, SITE_URL } from '~/utils/seo';
import { useMemo } from 'react';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import { Navbar } from '../components/Navbar.js';
import Footer from '../components/Footer.js';
import Giscus from '~/components/Giscus';

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
  const { getPost, getAllPostMeta } = await import('~/utils/posts.server');
  const post = await getPost(slug!);
  if (!post) {
    throw new Response('Not Found', { status: 404 });
  }

  // Prev/next within the same bucket (writing vs. project posts), newest first.
  const all = await getAllPostMeta();
  const isProject = post.frontmatter.type === 'project';
  const siblings = all.filter((p) => (p.type === 'project') === isProject);
  const idx = siblings.findIndex((p) => p.slug === slug);
  const toLink = (p?: { slug: string; title: string }) => (p ? { slug: p.slug, title: p.title } : null);
  const newer = toLink(siblings[idx - 1]);
  const older = toLink(siblings[idx + 1]);

  return { slug: slug!, code: post.code, frontmatter: post.frontmatter, newer, older };
};

export const meta: MetaFunction<typeof loader> = ({ data, params }) => {
  if (!data) {
    return buildMeta({ title: 'Post Not Found', noIndex: true });
  }
  const { title, subtitle } = data.frontmatter;
  // Optional `image:` frontmatter wins; otherwise the generated per-post card
  // (`ogImage`, injected at compile time); otherwise buildMeta's default card.
  const image =
    typeof data.frontmatter.image === 'string'
      ? data.frontmatter.image
      : typeof data.frontmatter.ogImage === 'string'
        ? data.frontmatter.ogImage
        : undefined;
  const url = `${SITE_URL}/blog/${params.slug}`;
  return [
    ...buildMeta({
      title,
      description: subtitle ?? `${title} — writing from Barron Wasteland.`,
      path: `/blog/${params.slug}`,
      type: 'article',
      image,
    }),
    // Article structured data; pairs with the Person schema on the homepage.
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: title,
        datePublished: data.frontmatter.date,
        url,
        mainEntityOfPage: url,
        ...(image ? { image: /^https?:\/\//.test(image) ? image : `${SITE_URL}${image}` } : {}),
        author: {
          '@type': 'Person',
          name: 'Tyler Barron',
          url: SITE_URL,
        },
      },
    },
  ];
};

interface PostNavCardProps {
  slug: string;
  title: string;
  direction: 'newer' | 'older';
}

function PostNavCard({ slug, title, direction }: PostNavCardProps) {
  const isNewer = direction === 'newer';
  return (
    <Link
      to={`/blog/${slug}`}
      className={`group block border-4 border-black bg-white p-4 no-underline transition-all duration-150 hover:no-underline motion-reduce:transition-none [@media(hover:hover)]:hover:bg-black ${isNewer ? 'text-left' : 'text-right md:col-start-2'}`}
    >
      <div className="font-mono text-[11px] text-neutral-500 uppercase [@media(hover:hover)]:group-hover:text-white/80">
        {isNewer ? '← Newer' : 'Older →'}
      </div>
      <div className="font-neo mt-1 font-extrabold tracking-tight text-black [@media(hover:hover)]:group-hover:text-white">
        {title.toUpperCase()}
      </div>
    </Link>
  );
}

export default function BlogPost() {
  const { slug, code, frontmatter, newer, older } = useLoaderData<typeof loader>();

  // Use getMDXComponent from mdx-bundler/client
  const Component = useMemo(() => getMDXComponent(code), [code]);

  // Comments are on by default; opt out per post with `comments: false` frontmatter.
  const commentsEnabled = frontmatter.comments !== false;
  // `ai: no` frontmatter adds a note under the post. YAML reads a bare `no` as the string "no".
  const writtenWithoutAi = frontmatter.ai === 'no' || frontmatter.ai === false;

  return (
    <div className="font-neo relative z-10 flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-grow py-8">
        <article className="mx-auto mb-8 max-w-4xl bg-white/95 px-6 py-8 backdrop-blur-sm lg:px-12">
          <header className="mb-8 pb-8">
            <h1 className="font-neo mb-6 text-center text-5xl leading-none font-extrabold tracking-tight text-black lg:text-6xl">
              {frontmatter.title.toUpperCase()}
            </h1>
            <div className="font-neo mb-6 text-center text-lg font-semibold tracking-wide text-black">
              {new Date(frontmatter.date)
                .toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  timeZone: 'UTC',
                })
                .toUpperCase()}
            </div>
            <div className="w-full border-t-4 border-black"></div>
          </header>

          <div className="prose prose-lg prose-headings:font-neo prose-headings:font-extrabold prose-headings:text-black prose-headings:uppercase prose-headings:tracking-tight prose-headings:border-b-2 prose-headings:border-accent prose-headings:pb-2 prose-p:font-neo prose-p:text-black prose-p:leading-relaxed prose-p:font-medium prose-p:text-lg prose-strong:text-black prose-strong:font-extrabold prose-a:text-black prose-a:no-underline prose-a:border-b-2 prose-a:border-black prose-a:pb-0.5 prose-a:font-semibold prose-a:transition-all prose-a:hover:bg-accent prose-a:hover:text-white prose-a:hover:border-accent prose-a:hover:px-1 prose-a:hover:-mx-1 prose-li:font-neo prose-li:text-black prose-li:font-medium prose-li:text-lg prose-li:my-1 prose-ul:font-neo prose-ul:text-black prose-ul:ml-6 prose-ul:my-4 prose-ul:list-disc prose-ul:pl-2 prose-ol:font-neo prose-ol:text-black prose-ol:ml-6 prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-2 prose-code:bg-neutral-100 prose-code:text-black prose-code:font-mono prose-code:text-[0.85em] prose-code:font-normal prose-code:before:content-none prose-code:after:content-none prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-sm prose-pre:bg-neutral-100 prose-pre:text-black prose-pre:border-l-4 prose-pre:border-black prose-pre:font-mono prose-pre:text-sm prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:bg-gray-100 prose-blockquote:font-neo prose-blockquote:pl-4 prose-blockquote:py-2 prose-blockquote:font-semibold prose-blockquote:text-lg prose-blockquote:not-italic prose-blockquote:before:content-none prose-blockquote:after:content-none prose-img:border-2 prose-img:border-black prose-img:transition-all prose-table:border-2 prose-table:border-black prose-table:font-neo prose-table:bg-white prose-table:font-medium prose-th:bg-black prose-th:text-white prose-th:border prose-th:border-black prose-th:font-bold prose-th:uppercase prose-td:border prose-td:border-black prose-td:px-2 prose-td:py-1 mx-auto max-w-none tracking-normal">
            <Component />
          </div>
          {writtenWithoutAi && (
            <p className="font-neo mt-12 border-t-2 border-black pt-4 text-base font-medium text-black italic">
              this was not written with AI, nor was it as much as grammar checked with AI. Enjoy
            </p>
          )}
        </article>

        {(newer || older) && (
          <nav
            aria-label="More posts"
            className="mx-auto mb-8 grid max-w-4xl grid-cols-1 gap-4 px-6 md:grid-cols-2 lg:px-0"
          >
            {newer && <PostNavCard {...newer} direction="newer" />}
            {older && <PostNavCard {...older} direction="older" />}
          </nav>
        )}

        {commentsEnabled && (
          <section className="mx-auto mb-8 max-w-4xl bg-white/95 px-6 py-8 backdrop-blur-sm lg:px-12">
            <h2 className="font-neo mb-6 border-b-4 border-black pb-2 text-2xl font-extrabold tracking-tight text-black uppercase">
              Comments
            </h2>
            <Giscus term={slug} />
          </section>
        )}
      </div>
      <Footer />
    </div>
  );
}
