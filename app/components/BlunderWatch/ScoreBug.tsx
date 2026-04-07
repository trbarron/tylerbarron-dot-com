// Live score display shown during playback

interface ScoreBugProps {
  score: number;
  blundersCaught: number;
  blundersTotal: number;
  falsePositives: number;
  blundersMissed: number;
  moveIndex: number;
  totalMoves: number;
}

export function ScoreBug({
  score,
  blundersCaught,
  blundersTotal,
  falsePositives,
  blundersMissed,
  moveIndex,
  totalMoves,
}: ScoreBugProps) {
  const progress = totalMoves > 0 ? Math.round(((moveIndex + 1) / totalMoves) * 100) : 0;

  return (
    <div className="bg-white border-4 border-black p-4 h-full flex flex-row md:flex-col w-full">
      {/* Mobile: single-row matching pregame sidebar height */}
      <div className="flex md:hidden items-center justify-between w-full px-0.5 gap-1">
        <p className="font-neo font-black text-2xl text-black leading-none whitespace-nowrap">{score}<span className="text-[10px] font-bold opacity-40 ml-1.5 uppercase">pts</span></p>
        <div className="flex gap-2 items-center flex-shrink-0">
            <div className="flex items-center gap-0.5 font-neo text-[9px] font-black uppercase tracking-tighter whitespace-nowrap">
                <span className="opacity-40">Caught</span>
                <span className="text-black">{blundersCaught}/{blundersTotal}</span>
            </div>
            <div className="flex items-center gap-0.5 font-neo text-[9px] font-black uppercase tracking-tighter whitespace-nowrap">
                <span className="opacity-40">Missed</span>
                <span className={blundersMissed > 0 ? 'text-black opacity-50' : 'text-black'}>{blundersMissed}</span>
            </div>
            <div className="flex items-center gap-0.5 font-neo text-[9px] font-black uppercase tracking-tighter whitespace-nowrap">
                <span className="opacity-40">False Pos.</span>
                <span className={falsePositives > 0 ? 'text-black opacity-50' : 'text-black'}>{falsePositives}</span>
            </div>
        </div>
      </div>

      {/* Desktop: vertical layout */}
      <div className="hidden md:flex md:flex-col md:h-full w-full">
        <div className="text-center mb-4 border-b-4 border-black pb-4">
          <p className="font-neo text-[10px] font-extrabold uppercase tracking-widest text-black opacity-60 mb-1">Score</p>
          <p className="font-neo font-black text-4xl text-black leading-none tracking-tighter whitespace-nowrap">{score}</p>
        </div>
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-neo text-xs font-extrabold text-black opacity-60 uppercase tracking-widest">Caught</span>
            <span className="font-neo font-black text-lg text-black whitespace-nowrap">{blundersCaught}/{blundersTotal}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-neo text-xs font-extrabold text-black opacity-60 uppercase tracking-widest">Missed</span>
            <span className={`font-neo font-black text-lg whitespace-nowrap ${blundersMissed > 0 ? 'text-black opacity-50' : 'text-black'}`}>
              {blundersMissed}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-neo text-xs font-extrabold text-black opacity-60 uppercase tracking-widest">False Pos.</span>
            <span className={`font-neo font-black text-lg whitespace-nowrap ${falsePositives > 0 ? 'text-black opacity-50' : 'text-black'}`}>
              {falsePositives}
            </span>
          </div>
        </div>
        <div className="mt-auto border-4 border-black h-3 bg-gray-100 overflow-hidden w-full">
          {/* eslint-disable-next-line react/forbid-dom-props */}
          <div className="h-full bg-black transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
        <p className="font-neo text-[10px] font-extrabold text-black opacity-60 uppercase tracking-widest text-center mt-2 whitespace-nowrap">
          Move {Math.max(0, moveIndex + 1)} / {totalMoves}
        </p>
      </div>
    </div>
  );
}
