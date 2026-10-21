import { useState } from 'react';
import type { LogEntry } from '~/utils/runescapeRascals/types';
import { clock } from './format';
import Clamp from './Clamp';

const KIND: Record<string, [label: string, solid: boolean]> = {
  decided: ['Decided', true],
  done: ['Done', false],
  blocked: ['Blocked', false],
  stuck: ['Stuck', false],
  stale: ['Ran long', false],
  interrupted: ['Interrupted', false],
  died: ['Died', true],
  death: ['Died', true],
  trade: ['Trade', false],
  council: ['Council', true],
  promise: ['Promise', false],
  cooldown: ['Cooldown', false],
};

interface DecisionLogProps {
  log: LogEntry[];
  names: string[];
  mounted: boolean;
}

/** Every decision, how each order ended, and council moments, newest first. */
export default function DecisionLog({ log, names, mounted }: DecisionLogProps) {
  const [filter, setFilter] = useState('all');
  const options = ['all', ...names, 'council'];
  const rows = log
    .slice()
    .reverse()
    .filter((e) => filter === 'all' || e.bot === filter)
    .slice(0, 120);

  return (
    <div className="flex h-full flex-col">
      <div role="group" aria-label="Filter the log" className="flex flex-wrap gap-1 px-4 pt-3">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={filter === o}
            onClick={() => setFilter(o)}
            className={`min-h-11 border-2 border-black px-3 text-xs font-bold tracking-wider uppercase transition-colors duration-100 ${filter === o ? 'bg-black text-white' : 'bg-white text-black hover:bg-black hover:text-white'}`}
          >
            {o}
          </button>
        ))}
      </div>
      <ol className="m-0 min-h-80 flex-1 basis-0 list-none overflow-y-auto px-4 pt-2 pb-3">
        {rows.length === 0 && (
          <li className="py-6 text-center font-mono text-xs text-neutral-700 uppercase">Nothing yet</li>
        )}
        {rows.map((e, k) => {
          const [label, solid] = KIND[e.kind] ?? [e.kind, false];
          return (
            <li
              key={`${e.t}-${k}`}
              className="grid grid-cols-[3rem_4rem_1fr] items-baseline gap-2 border-t-2 border-neutral-200 py-2 first:border-t-0 sm:grid-cols-[3rem_4rem_6rem_1fr]"
            >
              <time className="font-mono text-xs text-neutral-700" dateTime={new Date(e.t).toISOString()}>
                {mounted ? clock(e.t) : ''}
              </time>
              <span className="text-xs font-extrabold uppercase">{e.bot}</span>
              <span className="hidden sm:block">
                <span
                  className={`border-2 border-black px-1 text-[10px] leading-4 font-bold tracking-wider whitespace-nowrap uppercase ${solid ? 'bg-black text-white' : ''}`}
                >
                  {label}
                </span>
              </span>
              <span className="col-span-3 text-sm sm:col-span-1">
                <Clamp lines={2} className="leading-snug font-semibold">
                  {e.title}
                </Clamp>
                {e.detail && (
                  <Clamp lines={1} className="mt-0.5 font-mono text-xs leading-relaxed text-neutral-700">
                    {e.detail}
                  </Clamp>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
