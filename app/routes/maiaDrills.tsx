import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { LinksFunction } from "react-router";
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import AddGames from "~/components/MaiaDrills/AddGames";
import BuildForm from "~/components/MaiaDrills/BuildForm";
import Drill from "~/components/MaiaDrills/Drill";
import { buildMeta } from "~/utils/seo";
import { loadEditToken, saveEditToken } from "~/utils/maiaDrills/localStorage";
import { trackDrillStart, trackFavorite } from "~/utils/maiaDrills/tracking";
import type { Deck, DeckSummary, GameSource } from "~/utils/maiaDrills/types";

import chessgroundBase from "../styles/chessground.base.css?url";
import chessgroundBrown from "../styles/chessground.brown.css?url";
import chessgroundCburnett from "../styles/chessground.cburnett.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: chessgroundBase },
  { rel: "stylesheet", href: chessgroundBrown },
  { rel: "stylesheet", href: chessgroundCburnett },
];

export function meta() {
  return buildMeta({
    title: "Marginal Maia Mentor",
    description:
      "Flashcards from your own games: the positions where a slightly stronger player would have found a better move.",
    path: "/marginal-maia-mentor",
  });
}

const SOURCE_NAMES: Record<GameSource, string> = {
  lichess: "Lichess",
  chesscom: "Chess.com",
};

function describeSettings(d: Pick<Deck, "settings">): string {
  return `+${d.settings.delta} rating · ≥${d.settings.thresholdCp} cp · depth ${d.settings.depth}`;
}

function Panel({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="w-full border-4 border-black bg-white">
      <div className="flex items-center justify-between border-b-2 border-black px-6 py-3">
        <h2 className="font-neo text-sm font-bold tracking-wider text-black uppercase">
          {title}
        </h2>
        {aside}
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function FavoritesList() {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/maiaDrills/decks")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load decks.");
        if (!cancelled) setDecks(data.decks);
      })
      .catch(
        (err) =>
          !cancelled &&
          setError(
            err instanceof Error ? err.message : "Could not load decks.",
          ),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="font-neo text-sm text-red-700">{error}</p>;
  if (!decks) return <p className="font-neo text-sm text-gray-600">Loading…</p>;
  if (decks.length === 0) {
    return (
      <p className="font-neo text-sm text-gray-600">No favorite decks yet.</p>
    );
  }

  return (
    <ul className="space-y-2">
      {decks.map((d) => (
        <li key={d.id}>
          <Link
            to={`?deck=${d.id}`}
            className="group flex items-center justify-between gap-3 border-2 border-black p-3 hover:bg-black hover:text-white"
          >
            <span className="font-neo min-w-0">
              <span className="block truncate font-bold">
                ★ {d.username} · {d.cardCount} cards
              </span>
              <span className="block text-sm text-gray-600 group-hover:text-white/70">
                {SOURCE_NAMES[d.source]} · {describeSettings(d)} ·{" "}
                {d.stats.games} games ·{" "}
                {new Date(d.createdAt).toLocaleDateString()}
              </span>
            </span>
            <span className="font-neo shrink-0 text-sm font-extrabold uppercase">
              Open →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DeckView({
  deckId,
  deck,
  onDrill,
  onFavoriteChange,
  onUpdated,
}: {
  deckId: string;
  deck: Deck;
  onDrill: () => void;
  onFavoriteChange: (favorite: boolean) => void;
  onUpdated: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setToken(loadEditToken(deckId)), [deckId]);

  const toggleFavorite = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/maiaDrills/decks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: deckId,
          editToken: token,
          favorite: !deck.favorite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not update the deck.");
      onFavoriteChange(data.favorite);
      trackFavorite(data.favorite);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update the deck.",
      );
    } finally {
      setSaving(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; the URL bar has it anyway.
    }
  };

  const { stats } = deck;

  return (
    <div className="font-neo space-y-5 text-black">
      <div>
        <p className="text-3xl font-extrabold">{deck.cards.length} cards</p>
        <p className="text-sm text-gray-700">
          {deck.username} on {SOURCE_NAMES[deck.source]} ·{" "}
          {describeSettings(deck)}
        </p>
        <p className="mt-2 text-sm text-gray-700">
          From {stats.games} games and {stats.positions.toLocaleString()} of
          your moves. A stronger player chose differently{" "}
          {stats.disagreements.toLocaleString()} times, and {deck.cards.length}{" "}
          of those were worth at least {deck.settings.thresholdCp} cp.
          {stats.lost
            ? ` ${stats.lost.toLocaleString()} more came from positions you’d already lost and were left out.`
            : ""}
        </p>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onDrill}
          className="flex-1 border-4 border-black bg-black px-6 py-3 text-lg font-extrabold tracking-wide text-white uppercase hover:bg-white hover:text-black"
        >
          Start drilling
        </button>
        {token ? (
          <button
            onClick={toggleFavorite}
            disabled={saving}
            aria-pressed={!!deck.favorite}
            className="border-4 border-black px-4 py-3 font-extrabold tracking-wide uppercase hover:bg-black hover:text-white disabled:opacity-50"
          >
            {deck.favorite ? "★ Favorited" : "☆ Favorite"}
          </button>
        ) : (
          deck.favorite && (
            <span className="self-center px-2 font-bold">★ Favorite</span>
          )
        )}
        <button
          onClick={copyLink}
          className="border-4 border-black px-4 py-3 font-extrabold tracking-wide uppercase hover:bg-black hover:text-white"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      {token && !deck.favorite && (
        <p className="text-xs text-gray-600">
          Unfavorited decks are kept for 30 days. Favorite it to keep it and add
          it to the favorites list on the Marginal Maia Mentor page, where anyone can
          open it.
        </p>
      )}
      {/* Favorites are communal: anyone can add newer games to one. */}
      {(token || deck.favorite) && (
        <AddGames
          deckId={deckId}
          deck={deck}
          editToken={token}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}

export default function MaiaDrills() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deckId = searchParams.get("deck");
  const [deck, setDeck] = useState<Deck | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drilling, setDrilling] = useState(false);
  /** Bumped to refetch the deck after new games were added to it. */
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    setDrilling(false);
  }, [deckId]);

  useEffect(() => {
    if (!deckId) {
      setDeck(null);
      return;
    }
    let cancelled = false;
    setLoadError(null);
    fetch(`/api/maiaDrills/decks?id=${encodeURIComponent(deckId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load the deck.");
        if (!cancelled) setDeck(data.deck);
      })
      .catch(
        (err) =>
          !cancelled &&
          setLoadError(
            err instanceof Error ? err.message : "Could not load the deck.",
          ),
      );
    return () => {
      cancelled = true;
    };
  }, [deckId, reloads]);

  const handleBuilt = async (built: Omit<Deck, "createdAt">) => {
    const res = await fetch("/api/maiaDrills/decks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(built),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not save the deck.");
    saveEditToken(data.id, data.editToken);
    setSearchParams({ deck: data.id });
  };

  return (
    <>
      <Navbar />
      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
        <div className="border-4 border-black bg-white">
          <div
            className={`bg-black px-6 py-5 text-white ${deckId ? "" : "border-b-4 border-black"}`}
          >
            {/* Back to building a deck from anywhere: a deck, a drill, or the page itself. */}
            <Link
              to="/marginal-maia-mentor"
              className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 hover:opacity-80"
            >
              <h1 className="font-neo text-3xl leading-none font-extrabold tracking-tight uppercase md:text-4xl">
                Marginal Maia Mentor
              </h1>
              <span className="font-neo text-xs tracking-wide text-gray-400 uppercase">
                Work in progress
              </span>
            </Link>
          </div>
          {/* Only on the build page: on a deck or a drill it would push the board below the fold on a phone. */}
          {!deckId && (
            <div className="font-neo space-y-3 p-6 text-black">
              <p>
                Flashcards from your own games. For each move you made,{" "}
                <a
                  href="https://www.maiachess.com/"
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Maia
                </a>{" "}
                predicts what a player a bit stronger than you would have
                played. Where that move differs from yours and Stockfish says it
                was clearly better, the position becomes a card.
              </p>
              <p className="text-sm text-gray-600">
                Everything runs in your browser: a one-time ~44 MB model
                download, then a few minutes of analysis for a couple of hundred
                games. Only the finished cards are saved.
              </p>
            </div>
          )}
        </div>

        {deckId ? (
          loadError ? (
            <Panel title="Deck">
              <p className="font-neo text-red-700">{loadError}</p>
              <Link
                to="/marginal-maia-mentor"
                className="font-neo mt-3 inline-block text-sm underline"
              >
                Build a new deck
              </Link>
            </Panel>
          ) : !deck ? (
            <Panel title="Deck">
              <p className="font-neo text-sm text-gray-600">Loading…</p>
            </Panel>
          ) : drilling ? (
            <Drill
              deckId={deckId}
              deck={deck}
              onExit={() => setDrilling(false)}
            />
          ) : (
            <Panel
              title="Deck"
              aside={
                <Link
                  to="/marginal-maia-mentor"
                  className="font-neo text-xs font-bold tracking-wide uppercase underline"
                >
                  New deck
                </Link>
              }
            >
              <DeckView
                deckId={deckId}
                deck={deck}
                onDrill={() => {
                  trackDrillStart({ deckCards: deck.cards.length });
                  setDrilling(true);
                }}
                onFavoriteChange={(favorite) => setDeck({ ...deck, favorite })}
                onUpdated={() => setReloads((n) => n + 1)}
              />
            </Panel>
          )
        ) : (
          <>
            <Panel title="Build a deck">
              <BuildForm onBuilt={handleBuilt} />
            </Panel>
            <Panel title="Favorite decks">
              <FavoritesList />
            </Panel>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
