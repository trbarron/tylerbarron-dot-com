import Panel from '~/components/Panel';
import type { Snapshot } from '~/utils/runescapeRascals/types';

/** Recorded milestones, spread across the party instead of dominated by one character. */
export default function Highlights({ snapshot }: { snapshot: Snapshot }) {
  const achievements = [...(snapshot.achievements ?? [])].sort((a, b) => b.t - a.t);
  const selected = snapshot.bots.flatMap((bot) => achievements.filter((a) => a.by === bot.name).slice(0, 2));
  selected.sort((a, b) => b.t - a.t);
  if (!selected.length && !snapshot.board.length) return null;
  return (
    <Panel title="Party highlights">
      <ol className="m-0 grid list-none gap-3 p-4 sm:grid-cols-2">
        {selected.map((a) => (
          <li key={a.id} className="border-l-4 border-black pl-3">
            <p className="m-0 text-xs font-bold uppercase">
              {a.by} · <time dateTime={new Date(a.t).toISOString()}>{new Date(a.t).toISOString().slice(0, 10)}</time>
            </p>
            <p className="mt-1 mb-0 text-sm">{a.name}</p>
          </li>
        ))}
      </ol>
      {snapshot.board.length > 0 && (
        <details className="border-t-2 border-black px-4 py-3">
          <summary className="cursor-pointer text-sm font-bold">Party conversations</summary>
          {snapshot.board.slice(-4).map((post) => (
            <blockquote key={post.id} className="mx-0 my-3 border-l-2 border-neutral-300 pl-3 text-sm">
              <p className="m-0 whitespace-pre-wrap">{post.text}</p>
              <footer className="mt-1 text-xs font-bold uppercase">
                {post.from} → {post.to} · {new Date(post.t).toISOString().slice(0, 10)}
              </footer>
            </blockquote>
          ))}
        </details>
      )}
    </Panel>
  );
}
