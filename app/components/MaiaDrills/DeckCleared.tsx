import { useState } from 'react';
import Button from '~/components/Button';

interface DeckClearedProps {
  cardCount: number;
  /** Clears this browser's progress on every card. */
  onReset: () => void;
  onReview: () => void;
  onExit: () => void;
}

/** Every card's latest answer was right. Resetting asks first, since it can't be undone. */
export default function DeckCleared({ cardCount, onReset, onReview, onExit }: DeckClearedProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="font-neo space-y-4 border-4 border-black bg-white p-6 text-black" aria-live="polite">
      <p className="text-3xl font-extrabold">Deck cleared</p>
      <p className="text-sm text-gray-700">All {cardCount} solved: your latest answer on every card was right.</p>
      {confirming ? (
        <div className="space-y-2">
          <p className="text-sm font-bold">Clear your progress on all {cardCount} cards?</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="danger" onClick={onReset}>
              Reset
            </Button>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => setConfirming(true)}>
            Reset and start again
          </Button>
          <Button onClick={onReview}>Review solved cards</Button>
          <Button onClick={onExit}>Back to deck</Button>
        </div>
      )}
    </div>
  );
}
