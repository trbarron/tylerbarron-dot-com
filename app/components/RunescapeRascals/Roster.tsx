import { useState } from 'react';
import type { Bot } from '~/utils/runescapeRascals/types';
import { ago } from './format';
import Clamp from './Clamp';

interface RosterProps {
  bots: Bot[];
  now: number;
}

function Portrait({ bot, kind }: { bot: Bot; kind: 'head' | 'body' }) {
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const fallback = `/images/runescape-rascals/portraits/${bot.name.toLowerCase()}-${kind}.png`;
  const live = !!bot.portraitVersion && !failed;
  return (
    <img
      src={
        live
          ? `/api/runescapeRascals/portrait/${bot.name}/${kind}?v=${encodeURIComponent(bot.portraitVersion!)}`
          : fallback
      }
      alt=""
      width={kind === 'head' ? 84 : 30}
      height={84}
      loading="lazy"
      className={`h-[90px] w-full object-contain ${hidden ? 'invisible' : ''}`}
      onError={() => (live ? setFailed(true) : setHidden(true))}
    />
  );
}
const shotUrl = (b: Bot) => `/api/runescapeRascals/shot/${b.name}?t=${b.shotAt}`;

/** One strip with each character's level, current order, place and a thumbnail; full screenshots open below. */
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
            className={`flex min-w-0 flex-col gap-2 p-3 ${i % 2 ? 'border-l-4' : ''} ${i >= 2 ? 'border-t-4 md:border-t-0' : ''} ${i === 2 ? 'md:border-l-4' : ''} border-black`}
          >
            {/* Head, full body and name + level take a third each (on a phone the name drops below the two figures). */}
            <div className="grid grid-cols-2 items-center gap-1 md:h-[90px] md:grid-cols-3">
              <Portrait key={`${b.name}-head-${b.portraitVersion ?? 'static'}`} bot={b} kind="head" />
              <Portrait key={`${b.name}-body-${b.portraitVersion ?? 'static'}`} bot={b} kind="body" />
              <div className="col-span-2 flex min-w-0 items-baseline justify-between gap-2 md:col-span-1 md:flex-col md:items-start md:justify-center md:gap-1">
                <span className="flex items-center gap-1 text-base leading-none font-extrabold tracking-tight uppercase md:text-[18px]">
                  {b.name}
                </span>
                <span className="text-[26px] leading-none font-extrabold tabular-nums md:text-[30px]">
                  {b.totalLevel}
                  <span className="ml-0.5 text-[11px] font-bold tracking-wider">LVL</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              aria-expanded={open.has(b.name)}
              aria-controls="rascals-screens"
              aria-label={`${open.has(b.name) ? 'Hide' : 'Show'} ${b.name}'s screen`}
              onClick={() => toggle(b.name)}
              className={`group relative block cursor-pointer border-2 border-black p-0 ${open.has(b.name) ? 'outline-2 outline-offset-2 outline-black' : ''}`}
            >
              {b.shotAt ? (
                <img
                  src={shotUrl(b)}
                  alt=""
                  width={765}
                  height={503}
                  loading="lazy"
                  className="block aspect-[765/503] h-auto w-full object-cover"
                />
              ) : (
                <span className="grid aspect-[765/503] place-items-center bg-neutral-100 font-mono text-[10px] text-neutral-700 uppercase">
                  No screenshot yet
                </span>
              )}
              <span className="absolute right-0 bottom-0 bg-black px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase group-hover:underline">
                {open.has(b.name) ? 'Close' : 'Enlarge'}
              </span>
            </button>
            <Clamp lines={2} className="text-sm leading-snug font-bold break-words uppercase">
              {b.action.replace(/_/g, ' ')}
            </Clamp>
            <div className="font-mono text-xs leading-snug text-neutral-700">{b.location}</div>
          </div>
        ))}
      </div>
      {shown.length > 0 && (
        <div id="rascals-screens" className="grid gap-3 border-t-4 border-black p-3 md:grid-cols-2">
          {shown.map((b) => (
            <figure key={b.name} className="m-0 border-2 border-black">
              {b.shotAt ? (
                <img
                  src={shotUrl(b)}
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
