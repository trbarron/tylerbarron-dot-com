import type { ReactNode } from 'react';
import type { Bot, BotMetrics } from '~/utils/runescapeRascals/types';
import { Swatch } from './markers';
import { pct } from './format';

// Both tables put the characters in columns, so they read the same way side by side.

const TH = 'border-2 border-black bg-black px-2 py-1 text-right text-xs font-bold tracking-wider text-white uppercase';
const TD = 'border-2 border-black px-2 py-1 text-right font-mono text-sm tabular-nums';
const FIRST = 'text-left';

function Head({ bots, label }: { bots: Bot[]; label: string }) {
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

/** Not real skills: the client reports a couple of unused stat slots. */
const PLACEHOLDER = /^stat\d+$/i;

export function SkillsTable({ bots }: { bots: Bot[] }) {
  const level = (b: Bot, s: string) => b.skills.find((x) => x.name === s)?.level ?? 1;
  const all = [...new Set(bots.flatMap((b) => b.skills.map((s) => s.name)))].filter((n) => !PLACEHOLDER.test(n));
  const trained = all
    .filter((n) => bots.some((b) => level(b, n) > 1))
    .sort((a, b) => Math.max(...bots.map((x) => level(x, b))) - Math.max(...bots.map((x) => level(x, a))));
  const untrained = all.filter((n) => !trained.includes(n));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <Head bots={bots} label="Skill" />
        <tbody>
          {trained.map((s) => {
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
          {untrained.length > 0 && (
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
    </div>
  );
}

const METRICS: [string, (m: BotMetrics) => ReactNode, string][] = [
  [
    'XP per hour',
    (m) => (m.xpPerHour == null ? '–' : m.xpPerHour.toLocaleString('en-US')),
    'All skills combined; shown after ten minutes.',
  ],
  [
    'Decisions per hour',
    (m) => m.decisionsPerHour ?? '–',
    'Times the model was asked to set a new order; shown after ten minutes.',
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
  ['Model cost', (m) => `$${m.costUsd.toFixed(3)}`, 'This run.'],
];

export function NumbersTable({ bots }: { bots: Bot[] }) {
  const withMetrics = bots.filter((b) => b.metrics);
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <Head bots={withMetrics} label="This run" />
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
