import { LIMITS, type Deck } from '~/utils/maiaDrills/types';
import RunProgress, { RunMessages } from './RunProgress';
import { useAnalysisRun } from './useAnalysisRun';

interface AddGamesProps {
  deckId: string;
  deck: Deck;
  editToken: string;
  /** Called after the server took new cards, so the page can reload the deck. */
  onUpdated: () => void;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * Analyze the player's games since the deck's newest one, with the deck's own
 * settings, and merge the new cards in. Only shown to the browser that built
 * the deck.
 */
export default function AddGames({ deckId, deck, editToken, onUpdated }: AddGamesProps) {
  const run = useAnalysisRun();
  // Decks saved before this existed have no newest-game date; their creation is close enough.
  const since = deck.newestGameAt ?? Date.parse(deck.createdAt);
  const sinceLabel = new Date(since).toLocaleDateString();

  const add = () =>
    run.start(
      {
        source: deck.source,
        username: deck.username,
        max: LIMITS.games.max,
        excludeBullet: deck.excludeBullet ?? true,
        since,
        settings: deck.settings,
      },
      async (result) => {
        if (result.gamesFetched === 0) return `No new games since ${sinceLabel}.`;
        if (result.cancelled && result.cards.length === 0) return 'Stopped before any new cards were found.';

        const res = await fetch('/api/maiaDrills/decks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: deckId,
            editToken,
            cards: result.cards.slice(0, LIMITS.cardsPerDeck),
            stats: result.stats,
            // A stopped run skipped some games; leaving the date alone means the
            // next add looks at them again (cards it already has are skipped).
            newestGameAt: result.cancelled ? undefined : result.newestGameAt,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Could not update the deck.');
        onUpdated();

        const games = plural(result.gamesFetched, 'new game');
        const summary =
          data.added > 0
            ? `Added ${plural(data.added, 'card')} from ${games}.`
            : `${games[0].toUpperCase()}${games.slice(1)}, but no new errors at these settings.`;
        const skipped = result.skippedNoRating
          ? ` ${plural(result.skippedNoRating, 'game')} had no rating for you and were skipped.`
          : '';
        return summary + skipped;
      }
    );

  return (
    <div className="space-y-3 border-t-2 border-black pt-4">
      {run.busy ? (
        <RunProgress run={run} />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-700">Newest game analyzed: {sinceLabel}</p>
          <button
            onClick={add}
            className="border-2 border-black px-4 py-2 text-sm font-bold uppercase tracking-wide hover:bg-black hover:text-white"
          >
            Add new games
          </button>
        </div>
      )}
      <RunMessages run={run} />
    </div>
  );
}
