// Live score display shown during playback

interface ScoreBugProps {
  score: number;
  blundersCaught: number;
  blundersTotal: number;
  falsePositives: number;
  moveIndex: number;
  totalMoves: number;
}

export function ScoreBug({
  score,
  blundersCaught,
  blundersTotal,
  falsePositives,
  moveIndex,
  totalMoves,
}: ScoreBugProps) {
  const progress = totalMoves > 0 ? Math.round(((moveIndex + 1) / totalMoves) * 100) : 0;

  return (
    <div className="bg-white border-4 border-black p-3 h-full flex flex-row md:flex-col">
      {/* Mobile: single-row matching pregame sidebar height */}
      <div className="flex md:hidden items-center gap-3">
        <p className="font-neo font-black text-2xl text-black leading-none">{score}<span className="text-xs text-gray-400 ml-1">pts</span></p>
        <span className="font-neo text-xs text-gray-500 uppercase">Caught <span className="font-bold text-black">{blundersCaught}/{blundersTotal}</span></span>
        <span className="font-neo text-xs text-gray-500 uppercase">FP <span className={`font-bold ${falsePositives > 0 ? 'text-red-600' : 'text-black'}`}>{falsePositives}</span></span>
      </div>

      {/* Desktop: vertical layout */}
      <div className="hidden md:flex md:flex-col md:h-full">
        <div className="text-center mb-3">
          <p className="font-neo text-xs uppercase tracking-widest text-gray-500 mb-1">Score</p>
          <p className="font-neo font-black text-3xl text-black leading-none">{score}</p>
        </div>
        <div className="border-t-2 border-black pt-3 mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-neo text-xs text-gray-500 uppercase">Caught</span>
            <span className="font-neo font-bold text-sm text-black whitespace-nowrap">{blundersCaught}/{blundersTotal}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-neo text-xs text-gray-500 uppercase">False pos.</span>
            <span className={`font-neo font-bold text-sm whitespace-nowrap ${falsePositives > 0 ? 'text-red-600' : 'text-black'}`}>
              {falsePositives}
            </span>
          </div>
        </div>
        <div className="mt-auto border-2 border-black h-2 bg-gray-100">
          {/* eslint-disable-next-line react/forbid-dom-props */}
          <div className="h-full bg-black transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        <p className="font-neo text-xs text-gray-400 text-center mt-1 whitespace-nowrap">
          Move {Math.max(0, moveIndex + 1)} / {totalMoves}
        </p>
      </div>
    </div>
  );
}
