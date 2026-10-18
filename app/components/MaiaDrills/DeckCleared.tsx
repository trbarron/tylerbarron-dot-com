import { useState } from 'react';

interface DeckClearedProps {
  cardCount: number;
  /** Clears this browser's progress on every card. */
  onReset: () => void;
  onReview: () => void;
  onExit: () => void;
}

const primary =
  'border-4 border-black bg-black px-5 py-2 font-extrabold uppercase tracking-wide text-white hover:bg-white hover:text-black';
const secondary =
  'border-4 border-black px-5 py-2 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white';

/** Every card's latest answer was right. Resetting asks first, since it can't be undone. */
export default function DeckCleared({ cardCount, onReset, onReview, onExit }: DeckClearedProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-4 border-4 border-black bg-white p-6 font-neo text-black" aria-live="polite">
      <p className="text-3xl font-extrabold">Deck cleared</p>
      <p className="text-sm text-gray-700">All {cardCount} solved: your latest answer on every card was right.</p>
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm font-bold">Clear your progress on all {cardCount} cards?</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={onReset} className={primary}>
              Reset
            </button>
            <button onClick={() => setConfirming(false)} className={secondary}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setConfirming(true)} className={primary}>
            Reset and start again
          </button>
          <button onClick={onReview} className={secondary}>
            Review solved cards
          </button>
          <button onClick={onExit} className={secondary}>
            Back to deck
          </button>
        </div>
      )}
    </div>
  );
}
