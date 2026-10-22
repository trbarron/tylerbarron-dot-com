import { useState } from 'react';
import type { Bot, Post, Snapshot } from '~/utils/runescapeRascals/types';
import { Swatch } from './markers';
import { ago } from './format';
import Clamp, { TOGGLE } from './Clamp';

/** Posts shown before "Show all". */
const FIRST_POSTS = 5;

/** The party's message board: what they say to each other, newest first. */
export function Board({ posts, now }: { posts: Post[]; now: number }) {
  const [all, setAll] = useState(false);
  if (!posts.length)
    return <p className="m-0 px-4 py-6 text-center font-mono text-xs text-neutral-700 uppercase">Nothing posted yet</p>;
  const shown = posts
    .slice()
    .reverse()
    .slice(0, all ? undefined : FIRST_POSTS);
  return (
    <div className="flex flex-1 flex-col">
      {/* Folded, the latest few posts set the height; opened, they scroll inside a capped box. */}
      <ol className={`m-0 flex-1 list-none overflow-y-auto px-4 py-2 ${all ? 'max-h-[32rem]' : ''}`}>
        {shown.map((p) => (
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
      {posts.length > FIRST_POSTS && (
        <div className="px-4 pb-3">
          <button type="button" aria-expanded={all} onClick={() => setAll(!all)} className={TOGGLE}>
            {all ? 'Show fewer' : `Show all ${posts.length}`}
          </button>
        </div>
      )}
    </div>
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

/** Each character's routine: the steps their code runs without asking the model, current one marked. */
export function Routines({ bots }: { bots: Bot[] }) {
  return (
    <ul className="m-0 list-none px-4 py-2">
      {bots.map((b, i) => (
        <li key={b.name} className="border-t-2 border-neutral-200 py-1.5 text-sm first:border-t-0">
          <span className="mr-1 inline-flex items-center gap-1.5 font-extrabold uppercase">
            <Swatch index={i} />
            {b.name}
          </span>
          {b.routine ? (
            <>
              <span className="font-bold">{b.routine.name}</span>
              {b.routine.repeat && <span className="ml-1 font-mono text-xs text-neutral-700">(repeats)</span>}
              <ol className="m-0 mt-1 list-none p-0 font-mono text-xs leading-snug">
                {b.routine.steps.map((s, k) => (
                  <li
                    key={k}
                    aria-current={k === b.routine!.step ? 'step' : undefined}
                    className={
                      k === b.routine!.step
                        ? 'font-bold text-black'
                        : k < b.routine!.step
                          ? 'text-neutral-500 line-through'
                          : 'text-neutral-700'
                    }
                  >
                    {k === b.routine!.step ? '▸' : ' '} {k + 1}. {s}
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <span className="font-mono text-xs text-neutral-700">deciding</span>
          )}
        </li>
      ))}
    </ul>
  );
}
