import { useState, type ReactNode } from 'react';
import type { Bot, BotMetrics } from '~/utils/runescapeRascals/types';
import { Swatch } from './markers';
import { ago, pct } from './format';
import { TOGGLE } from './Clamp';

// Both tables put the characters in columns, so they read the same way side by side.

export const TH =
  'border-2 border-black bg-black px-2 py-1 text-right text-xs font-bold tracking-wider text-white uppercase';
export const TD = 'border-2 border-black px-2 py-1 text-right font-mono text-sm tabular-nums';
// TD aligns right, so the first column needs the important modifier to win.
export const FIRST = 'text-left!';

export function Head({ bots, label }: { bots: Bot[]; label: string }) {
  return (
    <thead>
      <tr>
        <th className={`${TH} ${FIRST}`}>{label}</th>
        {bots.map((b, i) => (
          <th key={b.name} className={TH}>
            <span className="inline-flex items-center gap-1">
              <Swatch index={i} inverted />
              {b.name}
            </span>
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** Everything the party has in its banks, with each owner in a column (banks are personal). */
export function StoresTable({ bots, now }: { bots: Bot[]; now: number }) {
  const banked = bots.filter((b) => b.bank);
  const items = [...new Set(banked.flatMap((b) => Object.keys(b.bank!.items)))]
    .filter((n) => !/^coins$/i.test(n))
    .map((n) => ({ n, total: banked.reduce((s, b) => s + (b.bank!.items[n] ?? 0), 0) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 14);
  if (!items.length)
    return <p className="m-0 px-4 py-6 text-center font-mono text-xs text-neutral-700 uppercase">No bank seen yet</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <Head bots={banked} label="Item" />
        <tbody>
          {items.map(({ n }) => (
            <tr key={n}>
              <td className={`${TD} ${FIRST} font-neo`}>{n}</td>
              {banked.map((b) => (
                <td key={b.name} className={TD}>
                  {b.bank!.items[n] ? b.bank!.items[n].toLocaleString('en-US') : '–'}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className={`${TD} ${FIRST} font-neo text-xs text-neutral-700`}>Last looked</td>
            {banked.map((b) => (
              <td key={b.name} className={`${TD} text-xs text-neutral-700`}>
                {ago(b.bank!.t, now)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** Not real skills: the client reports a couple of unused stat slots. */
const PLACEHOLDER = /^stat\d+$/i;
/** Highest skills shown before "All skills". */
const TOP_SKILLS = 5;

export function SkillsTable({ bots }: { bots: Bot[] }) {
  const [showAll, setShowAll] = useState(false);
  const level = (b: Bot, s: string) => b.skills.find((x) => x.name === s)?.level ?? 1;
  const all = [...new Set(bots.flatMap((b) => b.skills.map((s) => s.name)))].filter((n) => !PLACEHOLDER.test(n));
  const trained = all
    .filter((n) => bots.some((b) => level(b, n) > 1))
    .sort((a, b) => Math.max(...bots.map((x) => level(x, b))) - Math.max(...bots.map((x) => level(x, a))));
  const untrained = all.filter((n) => !trained.includes(n));
  const shown = showAll ? trained : trained.slice(0, TOP_SKILLS);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <Head bots={bots} label="Skill" />
        <tbody>
          {shown.map((s) => {
            const levels = bots.map((b) => level(b, s));
            const top = Math.max(...levels);
            return (
              <tr key={s}>
                <td className={`${TD} ${FIRST} font-neo`}>{s}</td>
                {levels.map((v, i) => (
                  <td
                    key={bots[i].name}
                    className={`${TD} ${v === top ? 'font-bold underline decoration-2 underline-offset-4' : ''}`}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            );
          })}
          <tr>
            <td className={`${TD} ${FIRST} font-neo`}>Combat level</td>
            {bots.map((b) => (
              <td key={b.name} className={TD}>
                {b.combat ?? '–'}
              </td>
            ))}
          </tr>
          <tr>
            <td className={`${TD} ${FIRST} font-neo font-bold`}>Total level</td>
            {bots.map((b) => (
              <td key={b.name} className={`${TD} font-bold`}>
                {b.totalLevel}
              </td>
            ))}
          </tr>
          {showAll && untrained.length > 0 && (
            <tr>
              <td
                colSpan={bots.length + 1}
                className={`${TD} ${FIRST} font-neo text-xs whitespace-normal text-neutral-700`}
              >
                Level 1 for everyone: {untrained.join(', ')}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {trained.length > TOP_SKILLS && (
        <div className="px-4 py-2">
          <button type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)} className={TOGGLE}>
            {showAll ? 'Top skills only' : `All skills (${trained.length - TOP_SKILLS} more)`}
          </button>
        </div>
      )}
    </div>
  );
}

const METRICS: [string, (m: BotMetrics) => ReactNode, string][] = [
  [
    'XP per hour',
    (m) => (m.xpPerHour == null ? '–' : m.xpPerHour.toLocaleString('en-US')),
    'All skills combined, per active hour (time the party was running).',
  ],
  [
    'Decisions per hour',
    (m) => m.decisionsPerHour ?? '–',
    'Times the model was asked to set a new routine, per active hour.',
  ],
  ['Repeat picks', (m) => pct(m.repeatRate), 'Picked the same action as the order before.'],
  ['Time resting', (m) => pct(m.rest), 'Share of order time spent resting.'],
  [
    'Promises kept',
    (m) => (m.commitments.made ? `${m.commitments.done}/${m.commitments.made}` : '–'),
    'Commitments later marked done.',
  ],
  ['Promises dropped', (m) => m.commitments.dropped, ''],
  [
    'Fits leanings',
    (m) => (m.leaningAlignment == null ? '–' : m.leaningAlignment.toFixed(2)),
    'Rank correlation between what their abilities favour and where their time goes (1 is a perfect match).',
  ],
  ['Prompt cache', (m) => pct(m.cacheHitRate), 'Input tokens served from the prompt cache.'],
  ['Model cost', (m) => `$${m.costUsd.toFixed(3)}`, 'Over the last 3 hours.'],
];

export function NumbersTable({ bots }: { bots: Bot[] }) {
  const withMetrics = bots.filter((b) => b.metrics);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <Head bots={withMetrics} label="Last 3 hours" />
        <tbody>
          {METRICS.map(([label, value, hint]) => (
            <tr key={label}>
              <td className={`${TD} ${FIRST} font-neo`} title={hint || undefined}>
                {label}
              </td>
              {withMetrics.map((b) => (
                <td key={b.name} className={TD}>
                  {value(b.metrics!)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className={`${TD} ${FIRST} font-neo`}>Deaths (all time)</td>
            {withMetrics.map((b) => (
              <td key={b.name} className={TD}>
                {b.deaths}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
