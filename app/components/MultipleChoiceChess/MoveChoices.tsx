import type { CandidateMove } from "~/utils/multipleChoiceChess/moveParser";
import { RANK_COLORS, RANK_LABELS } from "~/utils/multipleChoiceChess/scoring";

interface MoveChoicesProps {
  moves: CandidateMove[];
  selectedRank: number | null; // null = not yet picked, number = show feedback
  onPick: (move: CandidateMove) => void;
  disabled: boolean;
}

export default function MoveChoices({
  moves,
  selectedRank,
  onPick,
  disabled,
}: MoveChoicesProps) {
  const showFeedback = selectedRank !== null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {moves.map((move) => {
        const isPicked = showFeedback && move.rank === selectedRank;
        const feedbackClass = showFeedback ? RANK_COLORS[move.rank] : '';
        const label = showFeedback ? RANK_LABELS[move.rank] : null;

        return (
          <button
            key={move.uci}
            onClick={() => !disabled && !showFeedback && onPick(move)}
            disabled={disabled || showFeedback}
            className={[
              'relative border-4 border-black px-4 py-4 font-neo font-extrabold uppercase tracking-wide transition-colors',
              showFeedback
                ? feedbackClass
                : 'bg-white text-black hover:bg-black hover:text-white',
              isPicked ? 'ring-4 ring-black ring-offset-2' : '',
            ].join(' ')}
          >
            <span className="text-xl">{move.san}</span>
            {label && (
              <span className="absolute bottom-1 right-2 text-xs font-bold opacity-80">
                {label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
