import { Link } from 'react-router';

export interface PostListItem {
  slug: string;
  title: string;
  date: string;
}

export function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

function formatPostDate(iso: string) {
  return new Date(iso)
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
    .toUpperCase();
}

const newestFirst = (a: PostListItem, b: PostListItem) => new Date(b.date).getTime() - new Date(a.date).getTime();

/** Date | title | → rows that invert on hover. */
export function PostRows({ posts }: { posts: PostListItem[] }) {
  return (
    <ul className="bg-white/90 backdrop-blur-sm">
      {posts.map((post) => (
        <li key={post.slug} className="border-b border-black/10 last:border-b-0">
          <Link
            to={`/blog/${post.slug}`}
            className="group grid grid-cols-[110px_1fr_24px] items-center gap-5 px-3 py-3 no-underline transition-all duration-150 hover:no-underline motion-reduce:transition-none md:grid-cols-[140px_1fr_24px] [@media(hover:hover)]:hover:bg-black [@media(hover:hover)]:hover:pl-6"
          >
            <span className="font-mono text-xs text-neutral-500 uppercase [@media(hover:hover)]:group-hover:text-white/80">
              {formatPostDate(post.date)}
            </span>
            <span className="font-neo text-base font-black tracking-tight text-black md:text-lg [@media(hover:hover)]:group-hover:text-white">
              {post.title}
            </span>
            <span aria-hidden="true" className="text-right text-black/40 [@media(hover:hover)]:group-hover:text-white">
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The newest `count` posts. */
export function latestPosts<T extends PostListItem>(posts: T[], count: number): T[] {
  return posts.slice().sort(newestFirst).slice(0, count);
}

/** Every post under a year heading with its count, newest year first. */
export function PostsByYear({ posts }: { posts: PostListItem[] }) {
  const groups = new Map<number, PostListItem[]>();
  for (const p of posts.slice().sort(newestFirst)) {
    const year = new Date(p.date).getUTCFullYear();
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(p);
  }
  return (
    <div className="w-full space-y-12">
      {Array.from(groups.entries()).map(([year, items]) => (
        <div key={year}>
          <div className="flex items-baseline border-b-[2.5px] border-black pb-2">
            <h2 className="font-neo text-2xl font-black tracking-tight text-black md:text-3xl">{year}</h2>
            <span className="ml-auto font-mono text-[11px] text-neutral-500 uppercase">
              {pad2(items.length)} {items.length === 1 ? 'POST' : 'POSTS'}
            </span>
          </div>
          <PostRows posts={items} />
        </div>
      ))}
    </div>
  );
}
