import type { GameMode } from '~/utils/chesserGuesser/types';

interface PuzzleHistory {
  fen: string;
  eval: number;
  guess: number;
  timestamp: number;
  mode: GameMode;
}

interface ScoreDisplayProps {
  gameMode: GameMode;
  isReviewMode: boolean;
  lastEval: number;
  lastSlider: number;
  lastDailyScore?: number;
  currentPuzzleIndex: number;
  displayPuzzleNumber: number;
  totalCount: number;
  displayLimit: number;
  reviewPuzzle: PuzzleHistory | null;
  reviewPuzzleIndex: number;
  filteredHistory: PuzzleHistory[];
  copyFeedback: boolean;
  onNavigateReview: (direction: 'prev' | 'next', history: PuzzleHistory[]) => void;
  onCopyFEN: (fen: string) => void;
  onToggleReview: () => void;
}

export default function ScoreDisplay({
  gameMode,
  isReviewMode,
  lastEval,
  lastSlider,
  lastDailyScore,
  currentPuzzleIndex,
  displayPuzzleNumber,
  totalCount,
  displayLimit,
  reviewPuzzle,
  reviewPuzzleIndex,
  filteredHistory,
  copyFeedback,
  onNavigateReview,
  onCopyFEN,
  onToggleReview,
}: ScoreDisplayProps) {
  const shouldShow = lastEval !== 0 || lastSlider !== 0 || (isReviewMode && reviewPuzzle);

  if (!shouldShow) return null;

  const getHeaderText = () => {
    if (isReviewMode) {
      return `Puzzle #${displayPuzzleNumber} of ${totalCount}`;
    }
    if (gameMode === 'daily' && lastDailyScore !== undefined) {
      return `Puzzle #${currentPuzzleIndex} Complete`;
    }
    return 'Last Round';
  };

  const yourGuess = isReviewMode && reviewPuzzle ? (reviewPuzzle.guess / 100).toFixed(2) : lastSlider.toFixed(2);

  const actualEval = isReviewMode && reviewPuzzle ? (reviewPuzzle.eval / 100).toFixed(2) : lastEval.toFixed(2);

  const difference =
    isReviewMode && reviewPuzzle
      ? Math.abs((reviewPuzzle.eval - reviewPuzzle.guess) / 100).toFixed(2)
      : Math.abs(lastEval - lastSlider).toFixed(2);

  return (
    <div className="w-full border-4 border-black bg-white">
      {/* Header */}
      <div className="font-neo border-b-4 border-black bg-black px-4 py-2 text-center text-sm font-extrabold tracking-tighter text-white uppercase">
        {getHeaderText()}
      </div>

      {/* Content */}
      <div className="font-neo space-y-4 bg-white p-4 text-black">
        {/* Navigation buttons in review mode */}
        {isReviewMode && reviewPuzzle && (
          <div className="flex gap-2">
            <button
              onClick={() => onNavigateReview('next', filteredHistory)}
              disabled={reviewPuzzleIndex === filteredHistory.length - 1}
              className="flex-1 border-2 border-black bg-white px-2 py-1 text-xs font-black text-black uppercase transition-all hover:bg-black hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black"
            >
              ← Old
            </button>
            <button
              onClick={() => onNavigateReview('prev', filteredHistory)}
              disabled={reviewPuzzleIndex === 0}
              className="flex-1 border-2 border-black bg-white px-2 py-1 text-xs font-black text-black uppercase transition-all hover:bg-black hover:text-white disabled:opacity-30 disabled:hover:bg-white disabled:hover:text-black"
            >
              New →
            </button>
          </div>
        )}

        {/* Stats - shown in both modes */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between border-b-2 border-black/5 pb-1">
            <div className="text-[10px] font-extrabold tracking-wider text-black uppercase opacity-60">Your Guess</div>
            <div className="text-lg leading-none font-black tracking-tighter">{yourGuess}</div>
          </div>
          <div className="flex items-baseline justify-between border-b-2 border-black/5 pb-1">
            <div className="text-[10px] font-extrabold tracking-wider text-black uppercase opacity-60">Actual</div>
            <div className="text-lg leading-none font-black tracking-tighter">{actualEval}</div>
          </div>
        </div>

        {/* Difference */}
        <div className="border-t-4 border-black pt-2">
          <div className="text-[10px] font-extrabold tracking-widest text-black uppercase opacity-60">Difference</div>
          <div className="text-3xl leading-tight font-black tracking-tighter text-black">{difference}</div>
        </div>

        {/* Showing count indicator in review mode */}
        {isReviewMode && totalCount > displayLimit && (
          <div className="text-center text-[10px] font-bold text-black uppercase opacity-40">
            (Showing last {displayLimit} of {totalCount})
          </div>
        )}

        {/* Copy FEN and Exit Review buttons in review mode */}
        {isReviewMode && reviewPuzzle && (
          <div className="space-y-2 pt-2">
            <button
              onClick={() => onCopyFEN(reviewPuzzle.fen)}
              className={`w-full border-2 border-black px-4 py-2 text-xs font-black uppercase transition-all ${
                copyFeedback ? 'bg-black text-white' : 'bg-white text-black hover:bg-black hover:text-white'
              }`}
            >
              {copyFeedback ? 'FEN COPIED' : 'COPY FEN'}
            </button>
            <button
              onClick={onToggleReview}
              className="w-full border-2 border-black bg-black px-4 py-3 text-xs font-black text-white uppercase transition-all hover:bg-white hover:text-black"
            >
              EXIT REVIEW
            </button>
          </div>
        )}

        {/* View All button in normal mode */}
        {totalCount > 0 && !isReviewMode && (
          <button
            onClick={onToggleReview}
            className="mt-2 w-full border-2 border-black bg-black px-4 py-3 text-xs font-black text-white uppercase transition-all hover:bg-white hover:text-black"
          >
            VIEW ALL
          </button>
        )}
      </div>
    </div>
  );
}
