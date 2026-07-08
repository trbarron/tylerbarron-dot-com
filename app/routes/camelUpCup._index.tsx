import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLoaderData, useRevalidator } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { Navbar } from "../components/Navbar.js";
import Footer from "../components/Footer.js";
import Giscus from "~/components/Giscus";
import TrophyModel from "~/components/TrophyModel";
import { buildMeta } from "~/utils/seo";
import {
  activeTournamentId,
  fetchLeaderboard,
  fetchStatus,
} from "~/utils/camelUpCup/tournament.server";
import type { Leaderboard, LeaderboardBot, SubmissionStatus } from "~/utils/camelUpCup/types";

export function meta() {
  return buildMeta({
    title: "Camel Up Cup",
    description:
      "The living Camel Up Cup: upload a Python bot, it plays a tournament against the field, and the leaderboard updates.",
    path: "/camel-up-cup",
  });
}

export async function loader({ request }: LoaderFunctionArgs) {
  const [board, activeId] = await Promise.all([
    fetchLeaderboard(request),
    activeTournamentId(),
  ]);
  const active = activeId ? await fetchStatus(request, activeId) : null;
  return { board, active };
}

const POLL_INTERVAL_MS = 5000;
const TERMINAL_PHASES = new Set(["complete", "rejected", "error"]);

type SortKey = "elo" | "submitted" | "wins" | "games" | "winPct" | "avgCoins" | "maxMoveMs";
type SortDir = "asc" | "desc";

// Lower is better for max move time; higher is better for everything else.
// Submitted defaults to newest first.
const DEFAULT_SORT_DIR: Record<SortKey, SortDir> = {
  elo: "desc",
  submitted: "desc",
  wins: "desc",
  games: "desc",
  winPct: "desc",
  avgCoins: "desc",
  maxMoveMs: "asc",
};

/** Defensive parse: missing key, null, or garbage all become null (never "Invalid Date"). */
function parseSubmitted(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sortValue(bot: LeaderboardBot, key: SortKey): number | null {
  if (key === "submitted") return parseSubmitted(bot.submitted)?.getTime() ?? null;
  return bot[key] ?? null;
}

const ELO_TOOLTIP =
  "Winner-take-all Bradley-Terry rating on the Elo scale (anchored at 1500). " +
  "Only winning counts — 2nd place rates the same as 4th — and beating a " +
  "strong field pays more than farming a weak one. Wide spreads are normal.";

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  align = "right",
  title,
  className,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
  title?: string;
  className?: string;
}) {
  const active = sortKey === activeKey;
  return (
    <th
      className={`py-2 pr-2 cursor-pointer select-none ${align === "right" ? "text-right" : ""} ${active ? "text-white" : "text-gray-400 hover:text-white"} ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (dir === "desc" ? "descending" : "ascending") : "none"}
      title={title}
    >
      {label}
      {active ? (dir === "desc" ? " ▼" : " ▲") : ""}
    </th>
  );
}

function LeaderboardTable({ board }: { board: Leaderboard }) {
  const medals = ["🥇", "🥈", "🥉"];
  // Old cached boards during rollout may predate the rating system —
  // hide the Elo column and fall back to win % ordering.
  const hasElo = board.bots.some((bot) => typeof bot.elo === "number");
  const [sortKey, setSortKey] = useState<SortKey>(hasElo ? "elo" : "winPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      } else {
        setSortKey(key);
        setSortDir(DEFAULT_SORT_DIR[key]);
      }
    },
    [sortKey],
  );

  // Rank (and medals) always reflect standing by Elo (win % on boards
  // without ratings), independent of the column the table is sorted by.
  const rankByName = new Map(
    [...board.bots]
      .sort((a, b) =>
        hasElo ? (b.elo ?? -Infinity) - (a.elo ?? -Infinity) : b.winPct - a.winPct,
      )
      .map((bot, i) => [bot.name, i]),
  );

  const bots = [...board.bots].sort((a, b) => {
    const av = sortValue(a, sortKey);
    const bv = sortValue(b, sortKey);
    // Unrated (null elo) or undated bots sort last regardless of direction.
    if (av == null || bv == null) return (av == null ? 1 : 0) - (bv == null ? 1 : 0);
    const diff = av - bv;
    return sortDir === "desc" ? -diff : diff;
  });

  return (
    <div className="mx-auto overflow-x-auto px-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-2 pr-2">Rank</th>
            <th className="py-2 pr-2">Bot</th>
            <SortableHeader
              label="Uploaded"
              sortKey="submitted"
              activeKey={sortKey}
              dir={sortDir}
              onSort={handleSort}
              align="left"
              title="When the bot entered the tournament (house bots predate it)"
            />
            {hasElo && (
              <SortableHeader label="Elo" sortKey="elo" activeKey={sortKey} dir={sortDir} onSort={handleSort} title={ELO_TOOLTIP} />
            )}
            <SortableHeader label="Wins" sortKey="wins" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortableHeader label="Games" sortKey="games" activeKey={sortKey} dir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortableHeader label="Win %" sortKey="winPct" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
            <SortableHeader label="Coins" sortKey="avgCoins" activeKey={sortKey} dir={sortDir} onSort={handleSort} title="Average coins per game" className="hidden lg:table-cell" />
            <SortableHeader label="Max ms" sortKey="maxMoveMs" activeKey={sortKey} dir={sortDir} onSort={handleSort} title="Slowest move, in milliseconds" className="hidden lg:table-cell" />
          </tr>
        </thead>
        <tbody>
          {bots.map((bot) => {
            const rank = rankByName.get(bot.name) ?? 0;
            const submittedDate = parseSubmitted(bot.submitted);
            return (
              <tr key={bot.name} className="border-b border-gray-200">
                <td className="py-2 pr-2">{medals[rank] ?? rank + 1}</td>
                <td className="py-2 pr-2">
                  <div>
                    <span className="font-mono">{bot.name}</span>
                  </div>
                  {(bot.author || !bot.builtin) && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      {bot.author && <span>by {bot.author}</span>}
                      {!bot.builtin && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs whitespace-nowrap text-amber-800">
                          uploaded
                        </span>
                      )}
                    </div>
                  )}
                  {(bot.model || bot.note) && (
                    <div className="text-xs text-gray-400">
                      {bot.model ?? bot.note}
                      {bot.year ? ` · ${bot.year}` : ""}
                    </div>
                  )}
                </td>
                <td
                  className="py-2 pr-2 whitespace-nowrap text-gray-600"
                  title={bot.submitted ?? undefined}
                  suppressHydrationWarning
                >
                  {submittedDate
                    ? submittedDate.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </td>
                {hasElo && (
                  <td className="py-2 pr-2 text-right">
                    {typeof bot.elo === "number" ? Math.round(bot.elo) : "—"}
                  </td>
                )}
                <td className="hidden py-2 pr-2 text-right md:table-cell" title={`${bot.wins}`}>
                  {Math.round(bot.wins)}
                </td>
                <td className="hidden py-2 pr-2 text-right md:table-cell">{bot.games}</td>
                <td className="py-2 pr-2 text-right">{bot.winPct}%</td>
                <td className="hidden py-2 pr-2 text-right lg:table-cell">{bot.avgCoins}</td>
                <td className="hidden py-2 text-right lg:table-cell">{bot.maxMoveMs}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-500">
        {board.totalGames} games per tournament · random 4-player seatings ·
        ties split wins ·{" "}
        {hasElo && (
          <>
            <span title={ELO_TOOLTIP} className="cursor-help underline decoration-dotted">
              Elo
            </span>{" "}
            counts only wins, adjusted for opponent strength ·{" "}
          </>
        )}
        updated {new Date(board.updated).toLocaleString()}
      </p>
    </div>
  );
}

/** Reigning champion: best Elo (win % on pre-rating boards) among bots that
 *  have actually played. Null on an empty or gamesless board. */
function championOf(board: Leaderboard): LeaderboardBot | null {
  const hasElo = board.bots.some((bot) => typeof bot.elo === "number");
  const played = board.bots.filter((bot) => bot.games > 0);
  if (played.length === 0) return null;
  return [...played].sort((a, b) =>
    hasElo ? (b.elo ?? -Infinity) - (a.elo ?? -Infinity) : b.winPct - a.winPct,
  )[0];
}

function ChampionShowcase({ board }: { board: Leaderboard }) {
  const champion = championOf(board);
  if (!champion) return null;
  const hasElo = typeof champion.elo === "number";
  return (
    <section className="subarticle prose">
      <h3 className="subarticle-title">Champion</h3>
      <div className="overflow-hidden bg-white break-words">
        <div className="flex flex-col items-center gap-4 border-4 border-black bg-white p-4 sm:flex-row sm:gap-6">
          <div className="h-56 w-44 shrink-0">
            <TrophyModel alt={`Trophy awarded to ${champion.name}`} />
          </div>
          <div className="text-center sm:text-left">
            <div className="mt-1 font-mono text-2xl font-bold break-all">{champion.name}</div>
            {champion.author && (
              <div className="text-sm text-gray-600">by {champion.author}</div>
            )}
            <div className="mt-2 text-sm">
              {hasElo && `Elo ${Math.round(champion.elo as number)} · `}
              {champion.winPct}% win rate
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusPanel({ status }: { status: SubmissionStatus }) {
  const pct =
    status.totalGames && status.gamesDone
      ? Math.round((100 * status.gamesDone) / status.totalGames)
      : 0;

  if (status.phase === "rejected") {
    return (
      <div className="mx-4 mt-4 rounded border border-red-300 bg-red-50 p-4 text-sm lg:mx-auto lg:w-11/12">
        <p className="font-bold">
          {status.botName ?? "Your bot"} was rejected.
        </p>
        <p className="mt-1">{status.reason}</p>
      </div>
    );
  }
  if (status.phase === "error") {
    return (
      <div className="mx-4 mt-4 rounded border border-red-300 bg-red-50 p-4 text-sm lg:mx-auto lg:w-11/12">
        <p className="font-bold">Something broke while running the tournament.</p>
        <p className="mt-1">{status.reason}</p>
      </div>
    );
  }
  if (status.phase === "complete") {
    return (
      <div className="mx-4 mt-4 rounded border border-green-300 bg-green-50 p-4 text-sm lg:mx-auto lg:w-11/12">
        <p className="font-bold">
          {status.botName} is in! {status.rank ? `Finished rank #${status.rank}.` : ""}
        </p>
        <p className="mt-1">The leaderboard above reflects the new standings.</p>
      </div>
    );
  }
  return (
    <div className="mx-4 mt-4 rounded border border-black bg-black p-4 text-sm text-white lg:mx-auto lg:w-11/12">
      <div className="font-bold text-white">
        {status.phase === "running" ? (
          <>
            Tournament running — <span className="font-mono">{status.botName ?? "your bot"}</span>{" "}
            — {status.gamesDone}/{status.totalGames} games
          </>
        ) : (
          `${status.botName ?? "Submission"}: ${status.phase}…`
        )}
      </div>
      <div className="mt-2 h-2 w-full rounded bg-gray-700">
        {/* eslint-disable-next-line react/forbid-dom-props -- width is runtime tournament progress */}
        <div className="h-2 rounded bg-white transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-gray-300">
        A full run takes about an hour — you can close this page and check back.
      </div>
    </div>
  );
}

function UploadForm({ onSubmitted }: { onSubmitted: (id: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/camelUpCup/submit", {
        method: "POST",
        body: new FormData(e.currentTarget),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Submission failed.");
        return;
      }
      formRef.current?.reset();
      onSubmitted(data.id);
    } catch {
      setError("Submission failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="mx-auto mt-4 space-y-3 px-4 lg:w-11/12"
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex-1 text-sm">
          Bot name
          <input
            name="botName"
            required
            pattern="[A-Za-z][A-Za-z0-9_-]{2,23}"
            title="3–24 characters: letters, digits, underscores, or dashes; starts with a letter"
            placeholder="MyCamelBot"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 font-mono"
          />
        </label>
        <label className="flex-1 text-sm">
          Your name
          <input
            name="author"
            required
            maxLength={40}
            placeholder="Fred"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
      </div>
      <label className="block text-sm">
        Bot file (.py, max 64 KB)
        <input
          name="file"
          type="file"
          accept=".py"
          required
          className="mt-1 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-black file:px-3 file:py-1.5 file:text-white"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mx-auto block rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {busy ? "Submitting…" : "Enter the tournament"}
      </button>
    </form>
  );
}

const CamelUpCupLeaderboard = () => {
  const { board, active } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();
  const [status, setStatus] = useState<SubmissionStatus | null>(active);
  const [trackedId, setTrackedId] = useState<string | null>(active?.id ?? null);

  const track = useCallback((id: string) => {
    setTrackedId(id);
    setStatus(null);
  }, []);

  useEffect(() => {
    if (!trackedId || (status && TERMINAL_PHASES.has(status.phase))) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/camelUpCup/status?id=${trackedId}`);
        if (!res.ok) return;
        const next: SubmissionStatus = await res.json();
        setStatus(next);
        if (TERMINAL_PHASES.has(next.phase)) {
          revalidator.revalidate();
        }
      } catch {
        // transient poll failure — next tick retries
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [trackedId, status, revalidator]);

  return (
    <div className="flex min-h-screen flex-col bg-black bg-fixed relative z-10">
      <Navbar />
      <main className="flex-grow">
        <section className="article">
          <article className="article-card">
            <header className="article-header">
              <h1 className="article-title">Camel Up Cup</h1>
            </header>
            <div className="prose">
              <section className="subarticle prose">
                <div className="overflow-hidden bg-white break-words">
                  <p>
                    The{" "}
                    <Link to="/camel-up-cup/2018">
                      original 2018 bring-your-own-bot tournament
                    </Link>{" "}
                    never really ended.
                    <br />
                    Write a Python bot that plays Camel Up, upload it below,
                    and it'll play a batch of games against every bot on this
                    board.
                  </p>
                </div>
              </section>

              {board && <ChampionShowcase board={board} />}

              <section className="subarticle prose">
                <h3 className="subarticle-title">Standings</h3>
                <div className="overflow-hidden bg-white break-words">
                  {board ? (
                    <LeaderboardTable board={board} />
                  ) : (
                    <p>
                      No tournament results yet — be the first to kick one
                      off by submitting a bot.
                    </p>
                  )}
                </div>
              </section>

              <section className="subarticle prose">
                <h3 className="subarticle-title">Enter your bot</h3>
                <div className="overflow-hidden bg-white break-words">
                  <p>
                    One .py file, one class with a{" "}
                    <code className="font-mono">move(player, gamestate)</code>{" "}
                    method returning <code className="font-mono">[0]</code>{" "}
                    (roll), <code className="font-mono">[1, trap_type, pos]</code>,{" "}
                    <code className="font-mono">[2, camel]</code> (round bet),{" "}
                    <code className="font-mono">[3, camel]</code> (game winner) or{" "}
                    <code className="font-mono">[4, camel]</code> (game loser).
                    Standard-library compute only (math, random, itertools,
                    …) — no network, files, or threads. Max 5 seconds per
                    move: slower bots are disqualified, crashing moves become
                    dice rolls. Grab the engine and full rules from{" "}
                    <a href="https://github.com/trbarron/Camel_Up_Cup_2K18">
                      the GitHub repo
                    </a>{" "}
                    to test locally first.
                  </p>
                  {status && TERMINAL_PHASES.has(status.phase) ? (
                    <>
                      <StatusPanel status={status} />
                      <UploadForm onSubmitted={track} />
                    </>
                  ) : trackedId ? (
                    status ? (
                      <StatusPanel status={status} />
                    ) : (
                      <p className="mt-4 text-sm text-gray-600">
                        Submission received — waiting for the tournament to
                        pick it up…
                      </p>
                    )
                  ) : (
                    <UploadForm onSubmitted={track} />
                  )}
                </div>
              </section>
            </div>
          </article>
        </section>

        <section className="max-w-4xl mx-auto mb-8 bg-white/95 backdrop-blur-sm px-6 lg:px-12 py-8">
          <h2 className="text-2xl font-extrabold text-black font-neo uppercase tracking-tight border-b-4 border-black pb-2 mb-6">
            Comments
          </h2>
          <Giscus term="camel-up-cup" />
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CamelUpCupLeaderboard;
