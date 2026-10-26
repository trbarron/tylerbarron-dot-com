import type { Achievement } from '~/utils/runescapeRascals/types';
import { Swatch } from './markers';
import { ago } from './format';

interface AchievementsProps {
  achievements: Achievement[];
  names: string[];
  now: number;
}

/** Everything the party has unlocked, newest first, closed by default so a first visit stays short. */
export default function Achievements({ achievements, names, now }: AchievementsProps) {
  const newest = [...achievements].sort((a, b) => b.t - a.t);
  const per = names.map((n) => ({ n, count: achievements.filter((a) => a.by === n).length }));
  return (
    <details className="group border-4 border-black bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 hover:bg-black hover:text-white [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-sm font-extrabold tracking-wider uppercase">
            Achievements <span className="font-mono">{achievements.length}</span>
          </span>
          <span className="block text-xs text-neutral-600 group-hover:text-white/70">
            {per.map((p) => `${p.n} ${p.count}`).join(' · ')}
          </span>
        </span>
        <span aria-hidden="true" className="text-sm font-bold group-open:rotate-180">
          ↓
        </span>
      </summary>
      <ol className="m-0 max-h-96 list-none overflow-y-auto border-t-4 border-black p-0">
        {newest.map((a) => (
          <li key={a.id} className="flex items-baseline gap-3 border-b-2 border-neutral-200 px-4 py-1.5 text-sm">
            <span className="w-16 shrink-0 text-right font-mono text-xs text-neutral-600 tabular-nums">
              {ago(a.t, now)}
            </span>
            <span className="inline-flex w-16 shrink-0 items-center gap-1 text-xs font-bold tracking-wider uppercase">
              {names.includes(a.by) && <Swatch index={names.indexOf(a.by)} />}
              {a.by}
            </span>
            <span className="min-w-0">{a.name}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
