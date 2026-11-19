import { useState } from 'react';
import { data, useLoaderData } from 'react-router';
import { buttonClass } from '~/components/Button';
import Footer from '~/components/Footer';
import { Navbar } from '~/components/Navbar';
import Panel from '~/components/Panel';
import { buildMeta } from '~/utils/seo';
import { listRecorderScores, playerKey } from '~/utils/vampireSurvivors/leaderboard.server';
import snapshot from '~/utils/vampireSurvivors/snapshot.json';

const title = 'Vampire Survivors Bot Lab';
const description = 'Compare bots and humans on the original Vampire Survivors browser demo.';
const number = new Intl.NumberFormat('en-US');

export function meta() {
  return buildMeta({ title, description, path: '/vampire-survivors' });
}

function clock(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

type Score = (typeof snapshot.scores)[number];

export const headers = () => ({ 'Cache-Control': 'no-store' });

export async function loader() {
  const humans = new Map(
    snapshot.scores.filter((score) => score.kind === 'human').map((score) => [playerKey(score.name), score]),
  );
  let leaderboardAvailable = true;
  try {
    for (const score of await listRecorderScores()) {
      const key = playerKey(score.name);
      const old = humans.get(key);
      if (!old || score.time > old.time || (score.time === old.time && score.kills > old.kills)) {
        humans.set(key, { ...score, kind: 'human', mode: 'Recorder · self-reported' });
      }
    }
  } catch (error) {
    leaderboardAvailable = false;
    console.error('Vampire Survivors leaderboard read failed:', error);
  }
  const scores = [...snapshot.scores.filter((score) => score.kind === 'bot'), ...humans.values()].sort(
    (a, b) => b.time - a.time || b.kills - a.kills,
  );
  return data({ scores, leaderboardAvailable }, { headers: headers() });
}

function ScorePlot({ scores }: { scores: Score[] }) {
  const [selected, select] = useState(0);
  const score = scores[selected] ?? scores[0];
  const minutesPerTick = Math.ceil(Math.max(960, ...scores.map((entry) => entry.time)) / 240);
  const killsPerTick = 1000 * Math.ceil(Math.max(3000, ...scores.map((entry) => entry.kills)) / 3000);
  const survivalSteps = [0, 1, 2, 3, 4].map((tick) => tick * minutesPerTick);
  const killSteps = [0, 1, 2, 3].map((tick) => tick * killsPerTick);
  const maxSeconds = 240 * minutesPerTick;
  const maxKills = 3 * killsPerTick;
  return (
    <div className="p-3 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
        <span>Enemies defeated</span>
        <span className="flex gap-3">
          <span>
            <span aria-hidden="true" className="mr-1 inline-block size-2 rounded-full bg-black" />
            Bots
          </span>
          <span>
            <span aria-hidden="true" className="mr-1 inline-block size-2 rotate-45 border border-black bg-white" />
            Humans
          </span>
        </span>
      </div>
      <div
        role="group"
        aria-label="Survival time and enemies defeated by player"
        className="relative mx-9 mt-4 h-52 border-b-2 border-l-2 border-black sm:h-64"
      >
        {/* Plot coordinates come from the score data. */}
        {/* eslint-disable react/forbid-dom-props */}
        {killSteps.map((kills) => (
          <div
            key={kills}
            aria-hidden="true"
            className="absolute w-full border-t border-dashed border-gray-300"
            style={{ bottom: `${(100 * kills) / maxKills}%` }}
          >
            <span className="absolute right-full -translate-y-1/2 pr-2 font-mono text-[10px]">
              {kills ? `${kills / 1000}k` : '0'}
            </span>
          </div>
        ))}
        {survivalSteps.map((minutes) => (
          <span
            key={minutes}
            aria-hidden="true"
            className="absolute top-full mt-1 -translate-x-1/2 font-mono text-[10px]"
            style={{ left: `${(6000 * minutes) / maxSeconds}%` }}
          >
            {minutes}:00
          </span>
        ))}
        {scores.map((entry, index) => (
          <button
            key={`${entry.kind}:${entry.name}`}
            type="button"
            aria-label={`${entry.name}, ${clock(entry.time)}, ${number.format(entry.kills)} kills`}
            aria-pressed={index === selected}
            title={entry.name}
            onClick={() => select(index)}
            onFocus={() => select(index)}
            className={`group absolute grid size-6 -translate-x-1/2 translate-y-1/2 cursor-pointer place-items-center border-0 bg-transparent p-0 outline-none hover:bg-transparent ${index === selected ? 'z-10' : ''}`}
            style={{ left: `${(100 * entry.time) / maxSeconds}%`, bottom: `${(100 * entry.kills) / maxKills}%` }}
          >
            <span
              aria-hidden="true"
              className={`size-2.5 border outline-offset-2 outline-black group-hover:outline-2 group-focus-visible:outline-2 ${entry.kind === 'bot' ? 'rounded-full border-white bg-black' : 'rotate-45 border-black bg-white'} ${index === selected ? 'ring-1 ring-black' : ''}`}
            />
          </button>
        ))}
        {/* eslint-enable react/forbid-dom-props */}
      </div>
      <p className="mt-6 mb-2 text-center font-mono text-xs">Survival time</p>
      <p className="m-0 border-2 border-black bg-gray-50 p-2 font-mono text-xs" aria-live="polite">
        {score.name} · {clock(score.time)} · {number.format(score.kills)} kills · level {score.level} · seed{' '}
        {score.seed}
      </p>
    </div>
  );
}

const cell = 'border-x-0 border-y border-gray-200 px-3 py-2 whitespace-nowrap tabular-nums';
const header = 'border-b-2 border-black bg-gray-100 text-left font-mono text-xs uppercase';

export default function VampireSurvivors() {
  const { scores, leaderboardAvailable } = useLoaderData<typeof loader>();
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Navbar />
      <main className="font-neo mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 p-4 text-black">
        <header className="border-4 border-black bg-white p-4 sm:p-6">
          <h1 className="m-0 text-3xl leading-none font-extrabold tracking-tight uppercase sm:text-5xl">{title}</h1>
          <p className="mt-2 mb-4 text-sm">{description}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-xs">
            <a
              className={buttonClass({ variant: 'primary', size: 'sm' })}
              href="https://poncle.itch.io/vampire-survivors"
            >
              Play the browser demo
            </a>
            <a className={buttonClass({ size: 'sm' })} href="http://127.0.0.1:8766/">
              Play with local recorder
            </a>
            <a className="underline underline-offset-4" href="#replay">
              Watch the run
            </a>
            <a className="underline underline-offset-4" href="#comparison">
              Compare bot policies
            </a>
          </div>
          <details className="mt-3 text-sm">
            <summary className="w-fit cursor-pointer font-semibold">Local recorder setup</summary>
            <p className="mt-2 mb-0">
              Run <code>bun run setup:local</code> from your <code>vs-bot</code> checkout the first time. In the
              recorder, enter your name and select the option to publish your score to this leaderboard.
            </p>
          </details>
        </header>

        <Panel
          title="High scores"
          subtitle="Antonio · Mad Forest Normal · best run per player or bot · survival, then kills"
        >
          {!leaderboardAvailable && (
            <p className="m-0 border-b px-4 py-2 text-sm">Live player scores are temporarily unavailable.</p>
          )}
          <ScorePlot scores={scores} />
          {/* Allow keyboard users to scroll the table on narrow screens. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="High score table">
            <table className="w-full border-collapse border-0 text-sm">
              <thead className={header}>
                <tr>
                  {['Rank', 'Player', 'Time', 'Kills', 'Level', 'Seed', 'Mode'].map((column) => (
                    <th key={column} scope="col" className={cell}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scores.map((score, index) => (
                  <tr key={`${score.kind}:${score.name}`} className="border-b border-gray-200 last:border-b-0">
                    <td className={cell}>{index + 1}</td>
                    <th
                      className={`${cell} bg-white text-left font-semibold tracking-normal text-black normal-case`}
                      scope="row"
                    >
                      <span className="block max-w-28 [overflow-wrap:anywhere] whitespace-normal sm:max-w-none sm:whitespace-nowrap">
                        {score.name}
                      </span>
                    </th>
                    <td className={cell}>{clock(score.time)}</td>
                    <td className={cell}>{number.format(score.kills)}</td>
                    <td className={cell}>{score.level}</td>
                    <td className={cell}>{score.seed}</td>
                    <td className={cell}>{score.mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="m-0 border-t-2 border-black px-4 py-2 font-mono text-xs">
            Bot results through {snapshot.updatedOn} · bot scores from the v0.2.4 demo at six frames per decision
          </p>
        </Panel>

        <div id="replay" className="scroll-mt-4">
          <Panel title="Featured replay" subtitle="route-swing-safe-chests">
            <iframe
              className="block aspect-video w-full bg-black"
              src={`https://www.youtube.com/embed/${snapshot.youtubeId}`}
              title="Vampire Survivors replay by route-swing-safe-chests"
              loading="lazy"
              allow="encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
            <p className="m-0 px-4 py-2 text-sm">
              <a
                className="underline underline-offset-4"
                href={`https://www.youtube.com/watch?v=${snapshot.youtubeId}`}
              >
                Watch on YouTube
              </a>
            </p>
          </Panel>
        </div>

        <div id="comparison" className="scroll-mt-4">
          <Panel
            title="Bot comparison"
            subtitle={`Upgrade priority experiment · ${snapshot.matchedSeeds} matched seeds · paired against safe-chests`}
          >
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Paired bot comparison">
              <table className="w-full border-collapse border-0 text-sm">
                <thead className={header}>
                  <tr>
                    {['Policy', 'Median time', 'Paired Δ', 'Wins', 'Median XP', 'Median kills'].map((column) => (
                      <th key={column} scope="col" className={cell}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshot.benchmark.map((row, index) => (
                    <tr key={row.bot} className="border-b border-gray-200 last:border-b-0">
                      <th
                        className={`${cell} bg-white text-left font-semibold tracking-normal text-black normal-case`}
                        scope="row"
                      >
                        <span className="block max-w-28 [overflow-wrap:anywhere] whitespace-normal sm:max-w-none sm:whitespace-nowrap">
                          {row.bot}
                        </span>
                      </th>
                      <td className={cell}>{clock(row.medianSurvival)}</td>
                      <td className={cell}>
                        {index ? `${row.medianPairedSeconds > 0 ? '+' : ''}${row.medianPairedSeconds} s` : 'Reference'}
                      </td>
                      <td className={cell}>{index ? `${row.wins}/${snapshot.matchedSeeds}` : '—'}</td>
                      <td className={cell}>{number.format(row.medianXP)}</td>
                      <td className={cell}>{number.format(row.medianKills)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="m-0 border-t-2 border-black px-4 py-2 text-sm">
              The paired delta is the median of each seed’s time difference. A win means the candidate survived longer
              on that seed.
            </p>
          </Panel>
        </div>
      </main>
      <Footer />
    </div>
  );
}
