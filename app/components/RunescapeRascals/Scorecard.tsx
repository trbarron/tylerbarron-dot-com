import type { ScorecardRow } from '~/utils/runescapeRascals/types';
import { FIRST, TD, TH } from './Tables';
import { pct } from './format';

const num = (v: number | null, digits = 0) =>
  v == null ? '–' : v.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });

const COLUMNS: [string, (r: ScorecardRow) => string, string][] = [
  ['Hours', (r) => num(r.activeHours, 1), 'Active hours: long gaps, such as a sleeping laptop, are left out.'],
  ['Decisions/h', (r) => num(r.decisionsPerHour), 'Times the model was asked to plan, for the whole party.'],
  ['Steps/h', (r) => num(r.stepsPerHour), 'Steps of routines carried out by code.'],
  ['Blocked', (r) => (r.blocked == null ? '–' : pct(r.blocked)), 'Steps that could not run.'],
  ['Interrupted', (r) => (r.interrupted == null ? '–' : pct(r.interrupted)), 'Steps cut short by a post or a council.'],
  ['Posts/h', (r) => num(r.postsPerHour), 'Message board posts.'],
  ['XP/h', (r) => num(r.xpPerHour), 'All skills, the whole party.'],
  ['Making', (r) => pct(r.xpShare.making), 'Share of XP from smithing, cooking, crafting, fletching and firemaking.'],
  ['Deaths', (r) => String(r.deaths), ''],
  ['Milestones', (r) => String(r.milestones), 'Mission milestones completed.'],
  ['$/h', (r) => (r.costPerHour == null ? '–' : `$${r.costPerHour.toFixed(3)}`), 'Model cost per active hour.'],
];

/** Each change made to the agents, newest first, and how the party did until the next one. */
export default function Scorecard({ rows }: { rows: ScorecardRow[] }) {
  if (!rows.length)
    return (
      <p className="m-0 px-4 py-6 text-center font-mono text-xs text-neutral-700 uppercase">No changes recorded</p>
    );
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${TH} ${FIRST}`}>Change</th>
            {COLUMNS.map(([label, , hint]) => (
              <th key={label} className={`${TH} whitespace-nowrap`} title={hint || undefined}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows
            .slice()
            .reverse()
            .map((r, i) => (
              <tr key={r.t}>
                <td className={`${TD} ${FIRST} font-neo min-w-48 whitespace-normal`} title={r.note}>
                  <span className="font-bold">{r.name}</span>
                  {i === 0 && (
                    <span className="ml-2 border-2 border-black px-1 text-[10px] leading-4 font-bold tracking-wider uppercase">
                      Now
                    </span>
                  )}
                </td>
                {COLUMNS.map(([label, value]) => (
                  <td key={label} className={TD}>
                    {value(r)}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
