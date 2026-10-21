import type { Post, Snapshot } from '~/utils/runescapeRascals/types';
import { ago } from './format';
import Clamp from './Clamp';

/** The party's message board: what they say to each other, newest first. */
export function Board({ posts, now }: { posts: Post[]; now: number }) {
  if (!posts.length)
    return <p className="m-0 px-4 py-6 text-center font-mono text-xs text-neutral-700 uppercase">Nothing posted yet</p>;
  return (
    <ol className="m-0 min-h-56 flex-1 basis-0 list-none overflow-y-auto px-4 py-2">
      {posts
        .slice()
        .reverse()
        .map((p) => (
          <li key={p.id} className="border-t-2 border-neutral-200 py-2 first:border-t-0">
            <div className="font-mono text-xs text-neutral-700">
              <span className="font-neo mr-1 font-extrabold text-black uppercase">{p.from}</span>
              {p.to !== 'all' && `→ ${p.to} · `}
              {ago(p.t, now)}
              {p.council ? (
                <span className="font-neo ml-2 border-2 border-black px-1 text-[10px] leading-4 font-bold tracking-wider text-black uppercase">
                  Council {p.council}
                </span>
              ) : null}
            </div>
            <Clamp lines={3} className="mt-0.5 text-sm leading-snug">
              {p.text}
            </Clamp>
          </li>
        ))}
    </ol>
  );
}

/** Who agreed to do what at the last council. */
export function Plan({ plan }: { plan: Snapshot['plan'] }) {
  if (!plan)
    return (
      <p className="m-0 px-4 py-6 text-center font-mono text-xs text-neutral-700 uppercase">No council has met yet</p>
    );
  return (
    <ul className="m-0 list-none px-4 py-2">
      {Object.entries(plan.entries).map(([name, e]) => (
        <li key={name} className="border-t-2 border-neutral-200 py-2 text-sm leading-snug first:border-t-0">
          <span className="mr-1 font-extrabold uppercase">{name}</span>
          {e.commitment}
          {e.asks.length > 0 && (
            <span className="mt-0.5 block font-mono text-xs leading-relaxed text-neutral-700">
              {e.asks.map((a) => `asks ${a.to}: ${a.what}`).join(' · ')}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
