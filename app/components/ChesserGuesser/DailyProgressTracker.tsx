// Daily Progress Tracker Component
// Shows progress through the 4 daily puzzles

interface DailyProgressTrackerProps {
  currentPuzzle: number; // 0-3
  completedPuzzles: number; // 0-4
  totalScore: number;
  lastPuzzleScore?: number;
}

export function DailyProgressTracker({
  currentPuzzle,
  completedPuzzles,
  totalScore,
  lastPuzzleScore,
}: DailyProgressTrackerProps) {
  const puzzles = [0, 1, 2, 3];

  return (
    <div className="border-4 border-black bg-white">
      {/* Header */}
      <div className="font-neo border-b-4 border-black bg-black px-4 py-2 text-center text-sm font-extrabold tracking-tighter text-white uppercase">
        Progress
      </div>

      {/* Score Display */}
      <div className="border-b-4 border-black p-4 text-center">
        <div className="font-neo text-4xl font-black tracking-tighter text-black">{totalScore}</div>
        <div className="font-neo mt-1 text-[10px] font-extrabold tracking-widest text-black uppercase">Total Score</div>
        {lastPuzzleScore !== undefined && lastPuzzleScore >= 0 && (
          <div className="font-neo mt-2 inline-block border-2 border-black px-2 py-0.5 text-xs font-bold text-black uppercase">
            Last: +{lastPuzzleScore}
          </div>
        )}
      </div>

      {/* Progress Boxes */}
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2">
          {puzzles.map((puzzleIndex) => {
            const isCompleted = puzzleIndex < completedPuzzles;
            const isCurrent = puzzleIndex === currentPuzzle && !isCompleted;
            const _isPending = puzzleIndex > currentPuzzle;

            return (
              <div
                key={puzzleIndex}
                className={`font-neo flex aspect-square flex-col items-center justify-center border-2 text-xs ${
                  isCompleted
                    ? 'bg-accent border-accent text-white'
                    : isCurrent
                      ? 'animate-pulse border-black bg-white text-black'
                      : 'border-gray-300 bg-gray-100 text-gray-400'
                } `}
              >
                <div className="text-lg font-bold">{puzzleIndex + 1}</div>
                {isCompleted && <div className="text-xs">✓</div>}
              </div>
            );
          })}
        </div>
        <div className="font-neo mt-2 text-center text-xs text-gray-600">{completedPuzzles}/4 Completed</div>
      </div>
    </div>
  );
}
