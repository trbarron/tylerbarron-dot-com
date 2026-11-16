import { Fragment, type ReactNode } from 'react';
import Footer from '~/components/Footer';
import { Link, useLoaderData } from 'react-router';
import { buildMeta } from '~/utils/seo';
import { buttonClass } from '~/components/Button';
import { FEATURED_PROJECTS, PROJECT_CATEGORIES, PROJECTS, isExternal, type Project } from '~/utils/projects';
import { PostRows, latestPosts, pad2, type PostListItem } from '~/components/PostList';

export function meta() {
  return [
    ...buildMeta({ path: '/' }),
    // Person structured data so search engines connect the site to its author.
    {
      'script:ld+json': {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: 'Tyler Barron',
        url: 'https://tylerbarron.com',
        sameAs: ['https://github.com/trbarron', 'https://www.linkedin.com/in/tyler-barron-61972855/'],
      },
    },
  ];
}

interface Post extends PostListItem {
  type?: string;
}

export async function loader(): Promise<{ posts: Post[] }> {
  const { getAllPostMeta } = await import('~/utils/posts.server');
  const posts = await getAllPostMeta();
  return { posts: posts.map(({ slug, title, date, type }) => ({ slug, title, date, type })) };
}

/** Posts shown on the homepage; the rest are on /writing. */
const LATEST_POSTS = 5;

const BY_CATEGORY = PROJECT_CATEGORIES.map((c) => ({
  ...c,
  projects: PROJECTS.filter((p) => p.category === c.id),
}));

/** A site path renders a router link; an external project a plain anchor. */
function ProjectAnchor({ url, className, children }: { url: string; className: string; children: ReactNode }) {
  if (isExternal(url)) {
    return (
      <a href={url} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link to={url} className={className}>
      {children}
    </Link>
  );
}

function ProjectCard({ url, title, description }: Project) {
  return (
    // design-allow: shadow — a hard, offset, unblurred shadow: the "lift" DESIGN.md allows on interactive cards.
    <div className="border-4 border-black bg-white/90 backdrop-blur-sm transition-transform duration-150 ease-out motion-reduce:transition-none [@media(hover:hover)]:hover:-translate-x-[3px] [@media(hover:hover)]:hover:-translate-y-[3px] [@media(hover:hover)]:hover:shadow-[6px_6px_0_0_#111]">
      <ProjectAnchor url={url} className="block h-full p-5 no-underline hover:no-underline">
        <div className="font-neo text-lg font-bold tracking-wide text-black uppercase">{title}</div>
        <div className="font-neo mt-2 text-sm font-medium text-black opacity-75">{description}</div>
      </ProjectAnchor>
    </div>
  );
}

function ProjectRow({ url, title, description }: Project) {
  return (
    <li className="border-b border-black/10 last:border-b-0">
      <ProjectAnchor
        url={url}
        className="group grid grid-cols-[1fr_24px] items-center gap-5 px-3 py-3 no-underline transition-all duration-150 hover:no-underline motion-reduce:transition-none [@media(hover:hover)]:hover:bg-black [@media(hover:hover)]:hover:pl-6"
      >
        <span className="flex flex-col gap-1 md:grid md:grid-cols-[17rem_1fr] md:items-baseline md:gap-5">
          <span className="font-neo text-base font-black tracking-tight text-black md:text-lg [@media(hover:hover)]:group-hover:text-white">
            {title}
          </span>
          <span className="font-neo text-sm text-neutral-600 [@media(hover:hover)]:group-hover:text-white/80">
            {description}
          </span>
        </span>
        <span aria-hidden="true" className="text-right text-black/40 [@media(hover:hover)]:group-hover:text-white">
          {isExternal(url) ? '↗' : '→'}
        </span>
      </ProjectAnchor>
    </li>
  );
}

const indexLink = 'inline-block py-2 text-black no-underline hover:underline';

/** One line under the hero: every section with its count, each a jump link. */
function SectionIndex({ writingCount }: { writingCount: number }) {
  return (
    <nav aria-label="Sections" className="border-b-4 border-black bg-white px-4 py-2">
      <p className="mx-auto max-w-5xl text-center font-mono text-xs leading-relaxed text-neutral-500 uppercase md:text-sm">
        <Link to="#projects" className={`${indexLink} font-bold`}>
          Projects
        </Link>{' '}
        {pad2(PROJECTS.length)} —{' '}
        {BY_CATEGORY.map((c, i) => (
          <Fragment key={c.id}>
            <span className="whitespace-nowrap">
              <Link to={`#projects-${c.id}`} className={indexLink}>
                {c.short}
              </Link>{' '}
              {pad2(c.projects.length)}
              {i < BY_CATEGORY.length - 1 ? ' ·' : ''}
            </span>{' '}
          </Fragment>
        ))}
        —{' '}
        <span className="whitespace-nowrap">
          <Link to="#writing" className={`${indexLink} font-bold`}>
            Writing
          </Link>{' '}
          {pad2(writingCount)}
        </span>
      </p>
    </nav>
  );
}

const sectionHeading =
  'font-neo mb-12 inline-block scroll-mt-8 border-b-8 border-black bg-white px-4 pb-2 text-4xl font-extrabold tracking-tighter text-black uppercase lg:text-5xl';

export default function Index() {
  const { posts } = useLoaderData<typeof loader>();
  const writingPosts = posts.filter((post) => post.type !== 'project');

  return (
    <main className="font-neo relative z-10 min-h-screen">
      <section className="top-0 z-10 flex w-full items-center justify-center bg-white/95 py-20 backdrop-blur-sm">
        <div className="px-4 text-center">
          <h1 className="font-neo text-5xl font-extrabold tracking-tighter text-black md:text-7xl xl:text-8xl">
            BARRON WASTELAND
          </h1>
          <p className="font-neo mt-4 text-xl font-semibold tracking-wide text-black uppercase opacity-80 xl:text-2xl">
            A SERIES OF FLAT CIRCLES
          </p>
        </div>
      </section>
      <div className="border-t-4 border-black">
        <SectionIndex writingCount={writingPosts.length} />
      </div>

      <section className="relative flex w-full items-center justify-center py-20">
        {/* Vertical white runner behind the projects/writing column so the links read clearly over the dichroic background. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-0 left-1/2 z-0 w-[min(100%,1024px)] -translate-x-1/2 bg-white"
        />
        <div className="relative z-10 flex w-full max-w-5xl flex-col items-center">
          <h2 id="projects" className={sectionHeading}>
            PROJECTS
          </h2>

          <div className="w-full px-8">
            <div className="grid grid-cols-1 gap-4 pr-2 pb-3 pl-1 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
              {FEATURED_PROJECTS.map((p) => (
                <ProjectCard key={p.url} {...p} />
              ))}
            </div>

            <div className="mt-12 space-y-10">
              {BY_CATEGORY.map((c) => (
                <div key={c.id} id={`projects-${c.id}`} className="scroll-mt-8">
                  <div className="flex items-baseline border-b-[2.5px] border-black pb-2">
                    <h3 className="font-neo text-2xl font-black tracking-tight text-black uppercase md:text-3xl">
                      {c.label}
                    </h3>
                    <span className="ml-auto font-mono text-[11px] text-neutral-500 uppercase">
                      {pad2(c.projects.length)} {c.projects.length === 1 ? 'PROJECT' : 'PROJECTS'}
                    </span>
                  </div>
                  <ul className="bg-white/90 backdrop-blur-sm">
                    {c.projects.map((p) => (
                      <ProjectRow key={p.url} {...p} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 w-full px-8">
            <hr className="border-0 border-t-[3px] border-black" />
          </div>

          <h2 id="writing" className={`${sectionHeading} mt-16`}>
            WRITING
          </h2>

          <div className="w-full px-8">
            <div className="border-t-[2.5px] border-black">
              <PostRows posts={latestPosts(writingPosts, LATEST_POSTS)} />
            </div>
            <Link to="/writing" className={buttonClass({ className: 'mt-4 w-full no-underline hover:no-underline' })}>
              All {writingPosts.length} posts
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}

// Same HTML for everyone until the next deploy, so CloudFront may serve it.
export { cachedPageHeaders as headers } from '~/utils/cache';
