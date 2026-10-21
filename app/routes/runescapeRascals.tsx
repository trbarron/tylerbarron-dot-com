// Runescape Rascals: four LLM agents with D&D character sheets playing a RuneScape-style
// world together. Unlisted (no homepage link, not in the sitemap, noindex). The data is
// published to Redis by the orchestrator in the runscape-local project; this page only reads.

import { useState } from 'react';
import { useLoaderData } from 'react-router';
import { Navbar } from '../components/Navbar.js';
import Footer from '../components/Footer.js';
import Panel from '~/components/Panel';
import Notice from '~/components/Notice';
import { usePolling } from '~/hooks/usePolling';
import { buildMeta } from '~/utils/seo';
import { readSnapshot } from '~/utils/runescapeRascals/snapshot.server';
import type { Snapshot } from '~/utils/runescapeRascals/types';
import Roster from '~/components/RunescapeRascals/Roster';
import MissionPanel from '~/components/RunescapeRascals/MissionPanel';
import { NumbersTable, SkillsTable } from '~/components/RunescapeRascals/Tables';
import LevelChart from '~/components/RunescapeRascals/LevelChart';
import DecisionLog from '~/components/RunescapeRascals/DecisionLog';
import WorldMap from '~/components/RunescapeRascals/WorldMap';
import { Board, Plan } from '~/components/RunescapeRascals/Talk';
import { ago, useNow } from '~/components/RunescapeRascals/format';

export function meta() {
  return buildMeta({
    title: 'Runescape Rascals',
    description: 'Four AI agents with D&D character sheets, playing a RuneScape-style world together.',
    path: '/runescape-rascals',
    noIndex: true,
  });
}

export async function loader() {
  try {
    return { snapshot: await readSnapshot() };
  } catch (error) {
    console.error('Error loading Runescape Rascals:', error);
    return { snapshot: null };
  }
}

/** The orchestrator publishes every 15 seconds. */
const POLL_MS = 15000;
/** Older than this, the party is treated as offline. */
const STALE_MS = 2 * 60 * 1000;

export default function RunescapeRascals() {
  const initial = useLoaderData<typeof loader>();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initial.snapshot);
  const { now, mounted } = useNow(snapshot?.generatedAt ?? 0);

  usePolling(async () => {
    const res = await fetch('/api/runescapeRascals/snapshot');
    if (!res.ok) return;
    const data = (await res.json()) as { snapshot: Snapshot | null };
    if (data.snapshot) setSnapshot(data.snapshot);
  }, POLL_MS);

  const live = !!snapshot && now - snapshot.generatedAt < STALE_MS;
  const names = snapshot?.bots.map((b) => b.name) ?? [];

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Navbar />
      <main className="font-neo mx-auto flex w-full max-w-6xl flex-grow flex-col gap-4 p-4 text-black">
        <header className="border-4 border-black bg-white px-4 py-3">
          <h1 className="m-0 text-3xl leading-none font-extrabold tracking-tight uppercase md:text-4xl">
            Runescape Rascals
          </h1>
          {snapshot && (
            <p className="mt-2 mb-0 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs uppercase">
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`inline-block h-2 w-2 rounded-full border-2 border-black ${live ? 'bg-black' : ''}`}
                />
                {live ? 'Live' : `Last seen ${ago(snapshot.generatedAt, now)}`}
              </span>
            </p>
          )}
        </header>

        {!snapshot ? (
          <Notice tone="info" title="The party is offline">
            Nothing has been published in the last week. Check back later.
          </Notice>
        ) : (
          <>
            <MissionPanel mission={snapshot.teamGoal} now={now} />
            <Roster bots={snapshot.bots} now={now} />

            <Panel title="Total level over time">
              <LevelChart names={names} history={snapshot.history} mounted={mounted} />
            </Panel>

            <div className="grid items-stretch gap-4 md:grid-cols-2">
              <Panel
                title="Skills"
                aside={<span className="text-xs text-neutral-700">underlined = best in the party</span>}
                className="h-full min-w-0"
              >
                <SkillsTable bots={snapshot.bots} />
              </Panel>
              <Panel
                title="Meta stats"
                aside={
                  <span className="font-mono text-xs text-neutral-700">${snapshot.party.costPerHour.toFixed(3)}/h</span>
                }
                className="h-full min-w-0"
              >
                <NumbersTable bots={snapshot.bots} />
              </Panel>
            </div>

            <div className="grid items-stretch gap-4 md:grid-cols-[7fr_5fr]">
              <Panel
                title="Decision log"
                subtitle="The model is only asked when something changes"
                className="flex h-full min-w-0 flex-col"
              >
                <DecisionLog log={snapshot.log} names={names} mounted={mounted} />
              </Panel>
              <Panel
                title="Where they are"
                subtitle="Last 10 minutes of movement"
                className="flex h-full min-w-0 flex-col"
              >
                <div className="flex flex-1 items-center p-2">
                  <WorldMap bots={snapshot.bots} landmarks={snapshot.landmarks} />
                </div>
              </Panel>
            </div>

            <div className="grid items-stretch gap-4 md:grid-cols-2">
              <Panel title="Message board" className="flex h-full min-w-0 flex-col">
                <Board posts={snapshot.board} now={now} />
              </Panel>
              <Panel title="Party plan" className="h-full min-w-0">
                <Plan plan={snapshot.plan} />
              </Panel>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
