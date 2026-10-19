import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { LinksFunction } from 'react-router';
import { Navbar } from '~/components/Navbar';
import Footer from '~/components/Footer';
import AddGames from '~/components/MaiaDrills/AddGames';
import BuildForm from '~/components/MaiaDrills/BuildForm';
import Drill from '~/components/MaiaDrills/Drill';
import { ProgressBar } from '~/components/MaiaDrills/RunProgress';
import { buildMeta } from '~/utils/seo';
import { loadEditToken, saveEditToken, solvedCount } from '~/utils/maiaDrills/localStorage';
import { trackDrillStart, trackFavorite } from '~/utils/maiaDrills/tracking';
import { DEFAULT_SETTINGS, type Deck, type DeckSummary, type GameSource } from '~/utils/maiaDrills/types';

import chessgroundBase from '../styles/chessground.base.css?url';
import chessgroundBrown from '../styles/chessground.brown.css?url';
import chessgroundCburnett from '../styles/chessground.cburnett.css?url';
import Button from '~/components/Button';
import Panel from '~/components/Panel';
import { useCopy } from '~/hooks/useCopy';
import Notice from '~/components/Notice';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: chessgroundBase },
  { rel: 'stylesheet', href: chessgroundBrown },
  { rel: 'stylesheet', href: chessgroundCburnett },
];

export function meta() {
  return buildMeta({
    title: 'Marginal Maia Mentor',
    description:
      'Flashcards from your own games: the positions where a slightly stronger player would have found a better move.',
    path: '/marginal-maia-mentor',
  });
}

const SOURCE_NAMES: Record<GameSource, string> = {
  lichess: 'Lichess',
  chesscom: 'Chess.com',
};

/** The deck's error threshold: win chance, or cp on decks built before win chance. */
function describeThreshold(settings: Deck['settings']): string {
  return settings.thresholdWin === undefined && settings.thresholdCp !== undefined
    ? `≥${settings.thresholdCp} cp`
    : `≥${settings.thresholdWin ?? DEFAULT_SETTINGS.thresholdWin}% win chance`;
}

function settingsParts(settings: Deck['settings']): string[] {
  return [`+${settings.delta} rating`, describeThreshold(settings), `depth ${settings.depth}`];
}

function FavoritesList() {
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // This browser's drill progress, by deck id. The list only has card counts,
  // so a deck that later lost cards to the cap is clamped to its size.
  const [solvedByDeck, setSolvedByDeck] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    fetch('/api/maiaDrills/decks')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not load decks.');
        if (cancelled) return;
        setDecks(data.decks);
        const solved: Record<string, number> = {};
        for (const d of data.decks as DeckSummary[]) {
          const n = solvedCount(d.id);
          if (n !== null) solved[d.id] = Math.min(n, d.cardCount);
        }
        setSolvedByDeck(solved);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load decks.'));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <Notice>{error}</Notice>;
  if (!decks) return <p className="font-neo text-sm text-gray-600">Loading…</p>;
  if (decks.length === 0) {
    return <p className="font-neo text-sm text-gray-600">No favorite decks yet.</p>;
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
              {d.id in solvedByDeck && (
                <span className="block text-sm font-bold">
                  {solvedByDeck[d.id]}/{d.cardCount} solved
                </span>
              )}
              {[
                SOURCE_NAMES[d.source],
                ...settingsParts(d.settings),
                `${d.stats.games} games`,
                new Date(d.createdAt).toLocaleDateString(),
              ].map((detail) => (
                <span key={detail} className="block text-sm text-gray-600 group-hover:text-white/70">
                  {detail}
                </span>
              ))}
            </span>
            <span className="font-neo shrink-0 text-sm font-extrabold uppercase">Open →</span>
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
  const { state: copyState, copy } = useCopy();

  // Drill progress lives in this browser; the view remounts after a drill, so this stays current.
  const [solved, setSolved] = useState<number | null>(null);

  useEffect(() => setToken(loadEditToken(deckId)), [deckId]);
  useEffect(
    () =>
      setSolved(
        solvedCount(
          deckId,
          deck.cards.map((c) => c.id),
        ),
      ),
    [deckId, deck.cards],
  );

  const toggleFavorite = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/maiaDrills/decks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deckId,
          editToken: token,
          favorite: !deck.favorite,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not update the deck.');
      onFavoriteChange(data.favorite);
      trackFavorite(data.favorite);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the deck.');
    } finally {
      setSaving(false);
    }
  };

  const { stats } = deck;

  return (
    <div className="font-neo space-y-5 text-black">
      <div>
        <p className="text-3xl font-extrabold">{deck.cards.length} cards</p>
        {[`${deck.username} on ${SOURCE_NAMES[deck.source]}`, ...settingsParts(deck.settings)].map((detail) => (
          <p key={detail} className="text-sm text-gray-700">
            {detail}
          </p>
        ))}
        <p className="mt-2 text-sm text-gray-700">
          {stats.positions.toLocaleString()} moves from {stats.games} games. Maia disagreed on{' '}
          {stats.disagreements.toLocaleString()} and {deck.cards.length} of those cost{' '}
          {describeThreshold(deck.settings)}.
          {stats.lost ? ` ${stats.lost.toLocaleString()} from already-lost positions were skipped.` : ''}
        </p>
        {solved !== null && (
          <div className="mt-3">
            <ProgressBar
              label={solved === deck.cards.length ? 'Solved · deck cleared' : 'Solved'}
              value={solved}
              max={deck.cards.length}
            />
          </div>
        )}
      </div>

      {error && <Notice>{error}</Notice>}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" className="flex-1" onClick={onDrill}>
          Start drilling
        </Button>
        {token ? (
          <Button onClick={toggleFavorite} disabled={saving} aria-pressed={!!deck.favorite}>
            {deck.favorite ? '★ Favorited' : '☆ Favorite'}
          </Button>
        ) : (
          deck.favorite && <span className="self-center px-2 font-bold">★ Favorite</span>
        )}
        {/* If the clipboard is blocked, the URL bar has the link anyway. */}
        <Button onClick={() => copy(window.location.href)}>{copyState === 'copied' ? 'Copied' : 'Copy link'}</Button>
      </div>
      {token && !deck.favorite && (
        <p className="text-xs text-gray-600">
          Unfavorited decks are kept for 30 days. Favorite it to keep it and add it to the favorites list on the
          Marginal Maia Mentor page, where anyone can open it.
        </p>
      )}
      {/* Favorites are communal: anyone can add newer games to one. */}
      {(token || deck.favorite) && <AddGames deckId={deckId} deck={deck} editToken={token} onUpdated={onUpdated} />}
    </div>
  );
}

export default function MaiaDrills() {
  const [searchParams, setSearchParams] = useSearchParams();
  const deckId = searchParams.get('deck');
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
        if (!res.ok) throw new Error(data.error ?? 'Could not load the deck.');
        if (!cancelled) setDeck(data.deck);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Could not load the deck.'));
    return () => {
      cancelled = true;
    };
  }, [deckId, reloads]);

  const handleBuilt = async (built: Omit<Deck, 'createdAt'>) => {
    const res = await fetch('/api/maiaDrills/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(built),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Could not save the deck.');
    saveEditToken(data.id, data.editToken);
    setSearchParams({ deck: data.id });
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto flex w-full max-w-2xl flex-grow flex-col gap-6 p-4">
        <div className="border-4 border-black bg-white">
          <div className={`bg-black px-6 py-5 text-white ${deckId ? '' : 'border-b-4 border-black'}`}>
            {/* Back to building a deck from anywhere: a deck, a drill, or the page itself. */}
            <Link to="/marginal-maia-mentor" className="block hover:opacity-80">
              <h1 className="font-neo text-3xl leading-none font-extrabold tracking-tight uppercase md:text-4xl">
                Marginal Maia Mentor
              </h1>
            </Link>
          </div>
          {/* Only on the build page: on a deck or a drill it would push the board below the fold on a phone. */}
          {!deckId && (
            <div className="font-neo space-y-3 p-6 text-black">
              <p>
                <a href="https://www.maiachess.com/" className="underline" target="_blank" rel="noopener noreferrer">
                  Maia
                </a>{' '}
                predicts what a slightly stronger player would have played. When that is different from your move and
                Stockfish says it was clearly better the position becomes a flashcard for you to practice.
              </p>
              <p className="text-sm text-gray-600">Runs in your browser after a one-time ~44 MB download.</p>
            </div>
          )}
        </div>

        {deckId ? (
          loadError ? (
            <Panel padded className="w-full">
              <Notice>{loadError}</Notice>
              <Link to="/marginal-maia-mentor" className="font-neo mt-3 inline-block text-sm underline">
                Build a new deck
              </Link>
            </Panel>
          ) : !deck ? (
            <Panel padded className="w-full">
              <p className="font-neo text-sm text-gray-600">Loading…</p>
            </Panel>
          ) : drilling ? (
            <Drill deckId={deckId} deck={deck} onExit={() => setDrilling(false)} />
          ) : (
            // No title bar: the deck's card count heads it, and the page title
            // above already links back to building a new deck.
            <Panel padded className="w-full">
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
            <Panel padded className="w-full" title="Build a deck">
              <BuildForm onBuilt={handleBuilt} />
            </Panel>
            <Panel padded className="w-full" title="Favorite decks">
              <FavoritesList />
            </Panel>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
