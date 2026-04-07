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
  lastPuzzleScore
}: DailyProgressTrackerProps) {
  const puzzles = [0, 1, 2, 3];

  return (
    <div className="bg-white border-4 border-black">
      {/* Header */}
      <div className="bg-black text-white py-2 px-4 font-neo font-extrabold uppercase tracking-tighter text-sm border-b-4 border-black text-center">
        Progress
      </div>

      {/* Score Display */}
      <div className="p-4 text-center border-b-4 border-black">
        <div className="font-neo text-4xl font-black text-black tracking-tighter">
          {totalScore}
        </div>
        <div className="font-neo text-[10px] uppercase text-black font-extrabold tracking-widest mt-1">
          Total Score
        </div>
        {lastPuzzleScore !== undefined && lastPuzzleScore >= 0 && (
          <div className="mt-2 font-neo text-xs font-bold text-black border-2 border-black inline-block px-2 py-0.5 uppercase">
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
                className={`
                  aspect-square flex flex-col items-center justify-center
                  border-2 font-neo text-xs
                  ${isCompleted
                    ? 'bg-accent text-white border-accent'
                    : isCurrent
                      ? 'bg-white  text-black  border-black  animate-pulse'
                      : 'bg-gray-100  text-gray-400  border-gray-300 '
                  }
                `}
              >
                <div className="font-bold text-lg">
                  {puzzleIndex + 1}
                </div>
                {isCompleted && (
                  <div className="text-xs">✓</div>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-center mt-2 font-neo text-xs text-gray-600 ">
          {completedPuzzles}/4 Completed
        </div>
      </div>
    </div>
  );
}
