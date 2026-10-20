import { useState } from 'react';
import Button from '~/components/Button';
import type { Bot } from '~/utils/runescapeRascals/types';
import { Swatch } from './markers';
import { ago } from './format';

interface RosterProps {
  bots: Bot[];
  now: number;
}

/** One strip with each character's level, current order and place; screenshots open below. */
export default function Roster({ bots, now }: RosterProps) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (name: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) next.add(name);
      return next;
    });
  const shown = bots.filter((b) => open.has(b.name));

  return (
    <section className="font-neo border-4 border-black bg-white text-black" aria-label="The party">
      <div className="grid grid-cols-2 md:grid-cols-4">
        {bots.map((b, i) => (
          <div
            key={b.name}
            className={`relative flex min-w-0 flex-col gap-1 px-3 pt-3 pb-14 ${i % 2 ? 'border-l-4' : ''} ${i >= 2 ? 'border-t-4 md:border-t-0' : ''} ${i === 2 ? 'md:border-l-4' : ''} border-black`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2 text-xl leading-none font-extrabold tracking-tight uppercase">
                <Swatch index={i} />
                {b.name}
              </span>
              <span className="text-2xl leading-none font-extrabold tabular-nums">
                {b.totalLevel}
                <span className="ml-1 text-xs font-bold tracking-wider">LVL</span>
              </span>
            </div>
            <div className="text-sm font-bold break-words uppercase">{b.action.replace(/_/g, ' ')}</div>
            <div className="font-mono text-xs text-neutral-700">{b.location}</div>
            <Button
              size="sm"
              variant={open.has(b.name) ? 'primary' : 'secondary'}
              aria-expanded={open.has(b.name)}
              aria-controls="rascals-screens"
              onClick={() => toggle(b.name)}
              className="absolute right-3 bottom-2"
            >
              Screen
            </Button>
          </div>
        ))}
      </div>
      {shown.length > 0 && (
        <div id="rascals-screens" className="grid gap-3 border-t-4 border-black p-3 md:grid-cols-2">
          {shown.map((b) => (
            <figure key={b.name} className="m-0 border-2 border-black">
              {b.shotAt ? (
                <img
                  src={`/api/runescapeRascals/shot/${b.name}?t=${b.shotAt}`}
                  alt={`In-game view from ${b.name}`}
                  width={765}
                  height={503}
                  className="block h-auto w-full"
                />
              ) : (
                <div className="grid aspect-[765/503] place-items-center bg-neutral-100 font-mono text-xs text-neutral-700 uppercase">
                  No screenshot yet
                </div>
              )}
              <figcaption className="border-t-2 border-black px-2 py-1 text-xs font-bold tracking-wider uppercase">
                {b.name} · {b.shotAt ? ago(b.shotAt, now) : 'waiting'}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
