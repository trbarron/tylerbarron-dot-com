import { useEffect, useState } from 'react';
import { data, Link, useLoaderData, useRevalidator } from 'react-router';
import { buttonClass } from '~/components/Button';
import Footer from '~/components/Footer';
import { Navbar } from '~/components/Navbar';
import Panel from '~/components/Panel';
import { usePolling } from '~/hooks/usePolling';
import { buildMeta } from '~/utils/seo';
import { readRlDashboard, type RlEval, type RlUpdate } from '~/utils/vampireSurvivors/rl.server';

const title = 'Vampire Survivors RL';
const description =
  'A learned policy that steers the Vampire Survivors planner, trained on a Mac and compared with it.';
const number = new Intl.NumberFormat('en-US');
const staleMinutes = 30;

const modeNames: Record<string, string> = {
  ref: 'Reference',
  lane: 'Lane opener',
  wide: 'Wide clearance',
  xp: 'Gem focus',
  hunt: 'Brazier hunt',
  drift: 'North-west drift',
};

export function meta() {
  return buildMeta({ title, description, path: '/vampire-survivors/rl' });
}

export const headers = () => ({ 'Cache-Control': 'no-store' });

export async function loader() {
  return data({ ...(await readRlDashboard()), now: Date.now() }, { headers: headers() });
}

function clock(seconds: number | null) {
  if (seconds === null) return '—';
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

const signed = (seconds: number | null) => (seconds === null ? '—' : `${seconds > 0 ? '+' : ''}${seconds} s`);

function ago(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 90) return `${minutes} min ago`;
  const hours = Math.round(minutes / 6) / 10;
  return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

function niceStep(span: number, ticks: number, steps?: number[]) {
  const raw = span / ticks;
  if (steps) return steps.find((step) => step >= raw) ?? steps[steps.length - 1];
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * power).find((step) => step >= raw) ?? raw;
}

/** Axis steps for mm:ss values. */
const clockSteps = [15, 30, 60, 120, 300, 600];

type Point = { x: number; y: number; low?: number | null; high?: number | null; label: string };

/** One series over updates: a 2px line, square markers you can focus, an optional band and a reference line. */
function LineChart({
  points,
  name,
  yLabel,
  format,
  reference,
  steps,
}: {
  points: Point[];
  name: string;
  yLabel: string;
  format: (value: number) => string;
  reference?: { value: number; label: string };
  steps?: number[];
}) {
  const [selected, select] = useState(points.length - 1);
  if (!points.length) return <p className="m-0 p-4 text-sm">No data yet.</p>;
  const values = points.flatMap((p) => [p.y, p.low ?? p.y, p.high ?? p.y]);
  if (reference) values.push(reference.value);
  const step = niceStep(Math.max(1, Math.max(...values) - Math.min(...values)), 4, steps);
  const yMin = Math.floor(Math.min(...values) / step) * step;
  const yMax = Math.max(yMin + step, Math.ceil(Math.max(...values) / step) * step);
  const xMin = points[0].x;
  const xMax = Math.max(xMin + 1, points[points.length - 1].x);
  const left = (x: number) => (100 * (x - xMin)) / (xMax - xMin);
  const bottom = (y: number) => (100 * (y - yMin)) / (yMax - yMin);
  const ticks = Array.from({ length: Math.round((yMax - yMin) / step) + 1 }, (_, i) => yMin + i * step);
  const xTicks = Array.from(new Set([xMin, Math.round((xMin + xMax) / 2), xMax]));
  const band = points.every((p) => p.low !== undefined && p.low !== null && p.high !== null && p.high !== undefined)
    ? [
        ...points.map((p) => `${left(p.x)},${100 - bottom(p.high!)}`),
        ...[...points].reverse().map((p) => `${left(p.x)},${100 - bottom(p.low!)}`),
      ].join(' ')
    : null;
  const point = points[Math.min(selected, points.length - 1)];
  return (
    <div className="p-3 sm:p-5">
      <p className="m-0 mb-3 font-mono text-xs">{yLabel}</p>
      <div
        role="group"
        aria-label={name}
        className="relative mx-10 mt-2 h-48 border-b-2 border-l-2 border-black sm:h-60"
      >
        {/* Plot coordinates come from the data. */}
        {/* eslint-disable react/forbid-dom-props */}
        {ticks.map((tick) => (
          <div
            key={tick}
            aria-hidden="true"
            className="absolute w-full border-t border-dashed border-gray-200"
            style={{ bottom: `${bottom(tick)}%` }}
          >
            <span className="absolute right-full -translate-y-1/2 pr-2 font-mono text-[10px]">{format(tick)}</span>
          </div>
        ))}
        {xTicks.map((x) => (
          <span
            key={x}
            aria-hidden="true"
            className="absolute top-full mt-1 -translate-x-1/2 font-mono text-[10px]"
            style={{ left: `${left(x)}%` }}
          >
            {x}
          </span>
        ))}
        {reference && (
          <div
            aria-hidden="true"
            className="absolute w-full border-t-2 border-dashed border-black"
            style={{ bottom: `${bottom(reference.value)}%` }}
          >
            <span className="absolute -top-5 right-0 bg-white px-1 font-mono text-[10px]">{reference.label}</span>
          </div>
        )}
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {band && <polygon points={band} className="fill-gray-200" />}
          <polyline
            points={points.map((p) => `${left(p.x)},${100 - bottom(p.y)}`).join(' ')}
            className="fill-none stroke-black"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((p, index) => (
          <button
            key={p.x}
            type="button"
            aria-label={p.label}
            aria-pressed={index === selected}
            onClick={() => select(index)}
            onFocus={() => select(index)}
            className={`group absolute grid size-6 -translate-x-1/2 translate-y-1/2 cursor-pointer place-items-center border-0 bg-transparent p-0 outline-none hover:bg-transparent ${index === selected ? 'z-10' : ''}`}
            style={{ left: `${left(p.x)}%`, bottom: `${bottom(p.y)}%` }}
          >
            <span
              aria-hidden="true"
              className={`size-2 border border-white bg-black outline-offset-2 outline-black group-hover:outline-2 group-focus-visible:outline-2 ${index === selected ? 'ring-1 ring-black' : ''}`}
            />
          </button>
        ))}
        {/* eslint-enable react/forbid-dom-props */}
      </div>
      <p className="mt-6 mb-2 text-center font-mono text-xs">Update</p>
      <p className="m-0 border-2 border-black bg-gray-50 p-2 font-mono text-xs" aria-live="polite">
        {point.label}
      </p>
    </div>
  );
}

function ModeStrips({ updates, latestEval }: { updates: RlUpdate[]; latestEval: RlEval | undefined }) {
  const modes = Object.keys(modeNames);
  const recent = updates.slice(-120);
  if (!recent.length) return <p className="m-0 p-4 text-sm">No data yet.</p>;
  return (
    <div className="p-3 sm:p-5">
      <div className="mb-2 grid grid-cols-[6.5rem_1fr_2.75rem_2.75rem] gap-2 font-mono text-[10px] uppercase sm:grid-cols-[10rem_1fr_4.5rem_4.5rem] sm:gap-3">
        <span>Mode</span>
        <span>By update</span>
        <span className="text-right">Train</span>
        <span className="text-right">Greedy</span>
      </div>
      {modes.map((mode) => {
        const latest = recent[recent.length - 1].modeShare[mode] ?? 0;
        const greedy = latestEval?.modeShare?.[mode];
        return (
          <div
            key={mode}
            className="grid grid-cols-[6.5rem_1fr_2.75rem_2.75rem] items-end gap-2 border-t border-gray-200 py-1.5 text-sm sm:grid-cols-[10rem_1fr_4.5rem_4.5rem] sm:gap-3"
          >
            <span className="truncate text-xs sm:text-sm">{modeNames[mode]}</span>
            <span
              role="img"
              aria-label={`${modeNames[mode]}: ${Math.round(latest * 100)}% of training time in the latest update`}
              className="flex h-6 items-end gap-px border-b border-black"
            >
              {recent.map((update) => (
                <span
                  key={update.update}
                  className="min-w-px flex-1 bg-black"
                  // eslint-disable-next-line react/forbid-dom-props -- bar height is the share
                  style={{ height: `${100 * (update.modeShare[mode] ?? 0)}%` }}
                />
              ))}
            </span>
            <span className="text-right font-mono text-xs tabular-nums">{Math.round(latest * 100)}%</span>
            <span className="text-right font-mono text-xs tabular-nums">
              {greedy === undefined ? '—' : `${Math.round(greedy * 100)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const cell = 'border-x-0 border-y border-gray-200 px-3 py-2 whitespace-nowrap tabular-nums';
const header = 'border-b-2 border-black bg-gray-100 text-left font-mono text-xs uppercase';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-2 border-black p-3">
      <p className="m-0 font-mono text-[10px] uppercase">{label}</p>
      <p className="m-0 mt-1 text-xl font-extrabold tabular-nums sm:text-2xl">{value}</p>
    </div>
  );
}

export default function VampireSurvivorsRl() {
  const { available, status, updates, evals, events, now: serverNow } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [now, setNow] = useState(serverNow);
  usePolling(async () => {
    await revalidator.revalidate();
    setNow(Date.now());
  }, 60_000);
  useEffect(() => setNow(Date.now()), [serverNow]);

  const greedy = evals.filter((entry) => entry.set === 'eval');
  const heldout = evals.filter((entry) => entry.set === 'heldout');
  const best = greedy.reduce<RlEval | undefined>(
    (top, entry) =>
      top === undefined || (entry.pairedMedian ?? -Infinity) > (top.pairedMedian ?? -Infinity) ? entry : top,
    undefined,
  );
  const stale = status ? (now - Date.parse(status.time)) / 60_000 > staleMinutes : false;
  const overrideTotals = updates.slice(-10).reduce<Record<string, number>>((totals, update) => {
    for (const [name, count] of Object.entries(update.upgradeOverrides)) totals[name] = (totals[name] ?? 0) + count;
    return totals;
  }, {});
  const evalLabel = (entry: RlEval) =>
    `${entry.label} · paired median ${signed(entry.pairedMedian)} (95% CI ${signed(entry.ciLow)} to ${signed(entry.ciHigh)}) · ${entry.wins}–${entry.ties}–${entry.losses} · 15:00 reached ${entry.reach15} vs ${entry.refReach15} · median ${clock(entry.medianSurvival)}`;

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Navbar />
      <main className="font-neo mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 text-black">
        <header className="border-4 border-black bg-white p-4 sm:p-6">
          <h1 className="m-0 text-3xl leading-none font-extrabold tracking-tight uppercase sm:text-5xl">{title}</h1>
          <p className="m-0 mt-3 max-w-3xl text-sm sm:text-base">
            Every 4 seconds the policy picks which planner mode drives, and it can change level-up choices. Greedy play
            is compared with the reference planner on matched game seeds.
          </p>
          <Link className={`${buttonClass({ variant: 'secondary', size: 'sm' })} mt-4`} to="/vampire-survivors">
            Bot Lab
          </Link>
        </header>

        <Panel title="Full-game training pilot" subtitle="November 2026 · 96 matched seeds · 12 hours of training per arm">
          <div className="space-y-3 p-4 text-sm">
            <table className="w-full max-w-2xl text-left">
              <caption className="sr-only">Pilot survival by policy</caption>
              <thead>
                <tr className="border-b-2 border-black">
                  <th scope="col">Policy</th>
                  <th scope="col">Reached 15:00</th>
                  <th scope="col">Reached 17:00</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['Reference planner', 15, 0],
                  ['Starting checkpoint', 25, 0],
                  ['Half late-game practice', 26, 0],
                  ['Full-game training', 38, 0],
                ].map(([label, reach15, reach17]) => (
                  <tr key={label} className="border-b border-gray-200">
                    <th scope="row" className="py-1 font-medium">{label}</th>
                    <td className="font-mono">{reach15}/96</td>
                    <td className="font-mono">{reach17}/96</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="m-0">
              The full-game checkpoint gained 20 seconds in median paired survival over the planner
              (95% interval −7 to +44.5 seconds). Both training arms started from the same checkpoint.
            </p>
            <p className="m-0">
              Across the 96 games, the full-game policy spent 63% of game time using wider enemy clearance
              and 37% favoring braziers and Vacuums. It acquired Laurel in 63 games, compared with 14 for
              the planner. Which choices contributed to survival is still open.
            </p>
          </div>
        </Panel>

        <Panel title="Original training run" aside={status && <span className="font-mono text-xs">{ago(status.time, now)}</span>}>
          {!available && (
            <p className="m-0 border-b-2 border-black px-4 py-2 text-sm">Training data is temporarily unavailable.</p>
          )}
          {available && !status && <p className="m-0 px-4 py-3 text-sm">No training run has reported yet.</p>}
          {status && (
            <div className="p-3 sm:p-5">
              {stale && (
                <p role="status" className="m-0 mb-3 border-2 border-black bg-gray-100 px-3 py-2 text-sm">
                  No report for {ago(status.time, now).replace(' ago', '')}.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Phase" value={status.phase} />
                <Stat label="Update" value={number.format(status.update)} />
                <Stat label="Games" value={number.format(status.gamesPlayed)} />
                <Stat label="Best vs planner" value={best ? signed(best.pairedMedian) : '—'} />
              </div>
              <p className="m-0 mt-3 text-sm">{status.detail}</p>
              {status.progress && (
                <div className="mt-2">
                  <div
                    role="progressbar"
                    aria-label="Games finished in this step"
                    aria-valuemin={0}
                    aria-valuemax={status.progress.expected}
                    aria-valuenow={status.progress.done}
                    className="h-3 border-2 border-black"
                  >
                    <div
                      className="h-full bg-black"
                      // eslint-disable-next-line react/forbid-dom-props -- width is the progress
                      style={{ width: `${Math.min(100, (100 * status.progress.done) / status.progress.expected)}%` }}
                    />
                  </div>
                  <p className="m-0 mt-1 font-mono text-xs">
                    {status.progress.done} of {status.progress.expected} games · {number.format(status.gameHours)} game
                    hours since {status.startedAt ? new Date(status.startedAt).toISOString().slice(0, 10) : '—'}
                  </p>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel
          title="Greedy policy vs planner"
          subtitle="Paired median survival on 48 evaluation seeds; shaded: 95% interval"
        >
          <LineChart
            name="Paired median survival against the reference planner by update"
            yLabel="Seconds vs planner"
            format={(value) => `${value > 0 ? '+' : ''}${value}`}
            reference={{ value: 0, label: 'Planner' }}
            points={greedy
              .filter((entry) => entry.pairedMedian !== null)
              .map((entry) => ({
                x: entry.update,
                y: entry.pairedMedian!,
                low: entry.ciLow,
                high: entry.ciHigh,
                label: evalLabel(entry),
              }))}
          />
          {(greedy.length > 0 || heldout.length > 0) && (
            <details className="border-t-2 border-black">
              <summary className="cursor-pointer px-4 py-2 text-sm font-semibold">Evaluations</summary>
              {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
              <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Evaluation table">
                <table className="w-full border-collapse border-0 text-sm">
                  <thead className={header}>
                    <tr>
                      {[
                        'Policy',
                        'Seeds',
                        'Median',
                        'Paired median',
                        '95% CI',
                        'W–T–L',
                        '15:00',
                        'Died before 10:00',
                      ].map((column) => (
                        <th key={column} scope="col" className={cell}>
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...evals]
                      .reverse()
                      .slice(0, 40)
                      .map((entry) => (
                        <tr
                          key={`${entry.set}:${entry.label}:${entry.time}`}
                          className="border-b border-gray-200 last:border-b-0"
                        >
                          <th
                            className={`${cell} bg-white text-left font-semibold tracking-normal text-black normal-case`}
                            scope="row"
                          >
                            {entry.label}
                          </th>
                          <td className={cell}>{entry.set === 'heldout' ? 'Held out' : 'Evaluation'}</td>
                          <td className={cell}>
                            {clock(entry.medianSurvival)} vs {clock(entry.refMedianSurvival)}
                          </td>
                          <td className={cell}>{signed(entry.pairedMedian)}</td>
                          <td className={cell}>
                            {signed(entry.ciLow)} to {signed(entry.ciHigh)}
                          </td>
                          <td className={cell}>
                            {entry.wins}–{entry.ties}–{entry.losses}
                          </td>
                          <td className={cell}>
                            {entry.reach15} vs {entry.refReach15}
                          </td>
                          <td className={cell}>{entry.deathsBefore10}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </Panel>

        <Panel title="Training games" subtitle="Median survival of sampled games, new seeds each update">
          <LineChart
            name="Median survival of training games by update"
            yLabel="Survival"
            format={(value) => clock(value)}
            steps={clockSteps}
            points={updates
              .filter((update) => update.medianSurvival !== null)
              .map((update) => ({
                x: update.update,
                y: update.medianSurvival!,
                label: `Update ${update.update} · median ${clock(update.medianSurvival)} · ${update.games} games · level-up overrides ${Math.round(update.upgradeOverrideRate * 100)}%${update.rolloutMin === null ? '' : ` · ${update.rolloutMin} min`}`,
              }))}
          />
        </Panel>

        <Panel title="Planner modes" subtitle="Share of game time in each mode">
          <ModeStrips updates={updates} latestEval={greedy[greedy.length - 1]} />
        </Panel>

        <Panel title="Level-up overrides" subtitle="Picks that differ from the planner, last 10 updates">
          {Object.keys(overrideTotals).length ? (
            <ul className="m-0 grid list-none grid-cols-2 gap-x-6 p-4 text-sm sm:grid-cols-4">
              {Object.entries(overrideTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <li key={name} className="flex justify-between border-b border-gray-200 py-1">
                    <span>{name}</span>
                    <span className="font-mono tabular-nums">{count}</span>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="m-0 p-4 text-sm">None yet.</p>
          )}
        </Panel>

        <Panel title="Log">
          {events.length ? (
            <ol className="m-0 list-none p-0 text-sm">
              {events.map((event) => (
                <li
                  key={`${event.time}:${event.text}`}
                  className="flex gap-3 border-b border-gray-200 px-4 py-2 last:border-b-0"
                >
                  <time className="shrink-0 font-mono text-xs tabular-nums" dateTime={event.time}>
                    {event.time.slice(5, 16).replace('T', ' ')}
                  </time>
                  <span>{event.text}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="m-0 p-4 text-sm">Nothing yet.</p>
          )}
        </Panel>
      </main>
      <Footer />
    </div>
  );
}
