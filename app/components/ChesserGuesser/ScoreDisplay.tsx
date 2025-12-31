import type { GameMode } from "~/utils/chesserGuesser/types";

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
  const shouldShow = (lastEval !== 0 || lastSlider !== 0) || (isReviewMode && reviewPuzzle);

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

  const yourGuess = isReviewMode && reviewPuzzle
    ? (reviewPuzzle.guess / 100).toFixed(2)
    : lastSlider.toFixed(2);

  const actualEval = isReviewMode && reviewPuzzle
    ? (reviewPuzzle.eval / 100).toFixed(2)
    : lastEval.toFixed(2);

  const difference = isReviewMode && reviewPuzzle
    ? Math.abs((reviewPuzzle.eval - reviewPuzzle.guess) / 100).toFixed(2)
    : Math.abs(lastEval - lastSlider).toFixed(2);

  return (
    <div className="bg-white border-4 border-black overflow-hidden w-full col-span-3 md:col-span-1">
      {/* Header */}
      <div className="w-full border-b-2 border-accent py-2 flex flex-col items-center justify-center font-neo font-bold uppercase text-black bg-white">
        <span className="text-xs md:text-sm">{getHeaderText()}</span>
      </div>

      {/* Content */}
      <div className="p-3 md:p-4 bg-white text-black font-neo space-y-2">
        {/* Navigation buttons in review mode */}
        {isReviewMode && reviewPuzzle && (
          <div className="flex gap-1 mb-2">
            <button
              onClick={() => onNavigateReview('next', filteredHistory)}
              disabled={reviewPuzzleIndex === filteredHistory.length - 1}
              className="flex-1 px-1 py-1 bg-black text-white text-[10px] md:text-xs font-bold disabled:opacity-30"
            >
              ← Old
            </button>
            <button
              onClick={() => onNavigateReview('prev', filteredHistory)}
              disabled={reviewPuzzleIndex === 0}
              className="flex-1 px-1 py-1 bg-black text-white text-[10px] md:text-xs font-bold disabled:opacity-30"
            >
              New →
            </button>
          </div>
        )}

        {/* Stats - shown in both modes */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-left">
            <div className="text-gray-600 uppercase text-[10px]">Your Guess</div>
            <div className="font-bold text-sm">{yourGuess}</div>
          </div>
          <div className="text-right">
            <div className="text-gray-600 uppercase text-[10px]">Actual</div>
            <div className="font-bold text-sm">{actualEval}</div>
          </div>
        </div>

        {/* Difference */}
        <div className="border-t-2 border-gray-200 pt-2">
          <div className="text-gray-600 uppercase text-[10px]">Difference</div>
          <div className="font-bold text-lg text-accent">{difference}</div>
        </div>

        {/* Showing count indicator in review mode */}
        {isReviewMode && totalCount > displayLimit && (
          <div className="text-center text-gray-600 text-[10px] pt-1">
            (Showing last {displayLimit} of {totalCount})
          </div>
        )}

        {/* Copy FEN and Exit Review buttons in review mode */}
        {isReviewMode && reviewPuzzle && (
          <div className="space-y-1 mt-2">
            <button
              onClick={() => onCopyFEN(reviewPuzzle.fen)}
              className={`w-full px-2 py-1 text-[10px] font-bold transition-colors ${
                copyFeedback
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {copyFeedback ? 'FEN Copied' : 'Copy FEN'}
            </button>
            <button
              onClick={onToggleReview}
              className="w-full px-3 py-2 bg-accent text-white font-bold text-xs hover:bg-black transition-colors"
            >
              Exit Review
            </button>
          </div>
        )}

        {/* View All button in normal mode */}
        {totalCount > 0 && !isReviewMode && (
          <button
            onClick={onToggleReview}
            className="w-full mt-2 px-3 py-2 bg-black text-white font-bold text-xs hover:bg-accent transition-colors"
          >
            View All Puzzles →
          </button>
        )}
      </div>
    </div>
  );
}
