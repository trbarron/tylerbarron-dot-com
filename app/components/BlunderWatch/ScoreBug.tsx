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
    <div className="flex h-full w-full flex-row border-4 border-black bg-white p-4 md:flex-col">
      {/* Mobile: single-row matching pregame sidebar height */}
      <div className="flex w-full items-center justify-between gap-1 px-0.5 md:hidden">
        <p className="font-neo text-2xl leading-none font-black whitespace-nowrap text-black">
          {score}
          <span className="ml-1.5 text-[10px] font-bold uppercase opacity-40">pts</span>
        </p>
        <div className="flex flex-shrink-0 items-center gap-2">
          <div className="font-neo flex items-center gap-0.5 text-[9px] font-black tracking-tighter whitespace-nowrap uppercase">
            <span className="opacity-40">Caught</span>
            <span className="text-black">
              {blundersCaught}/{blundersTotal}
            </span>
          </div>
          <div className="font-neo flex items-center gap-0.5 text-[9px] font-black tracking-tighter whitespace-nowrap uppercase">
            <span className="opacity-40">Missed</span>
            <span className={blundersMissed > 0 ? 'text-black opacity-50' : 'text-black'}>{blundersMissed}</span>
          </div>
          <div className="font-neo flex items-center gap-0.5 text-[9px] font-black tracking-tighter whitespace-nowrap uppercase">
            <span className="opacity-40">False Pos.</span>
            <span className={falsePositives > 0 ? 'text-black opacity-50' : 'text-black'}>{falsePositives}</span>
          </div>
        </div>
      </div>

      {/* Desktop: vertical layout */}
      <div className="hidden w-full md:flex md:h-full md:flex-col">
        <div className="mb-4 border-b-4 border-black pb-4 text-center">
          <p className="font-neo mb-1 text-[10px] font-extrabold tracking-widest text-black uppercase opacity-60">
            Score
          </p>
          <p className="font-neo text-4xl leading-none font-black tracking-tighter whitespace-nowrap text-black">
            {score}
          </p>
        </div>
        <div className="mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-neo text-xs font-extrabold tracking-widest text-black uppercase opacity-60">
              Caught
            </span>
            <span className="font-neo text-lg font-black whitespace-nowrap text-black">
              {blundersCaught}/{blundersTotal}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-neo text-xs font-extrabold tracking-widest text-black uppercase opacity-60">
              Missed
            </span>
            <span
              className={`font-neo text-lg font-black whitespace-nowrap ${blundersMissed > 0 ? 'text-black opacity-50' : 'text-black'}`}
            >
              {blundersMissed}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-neo text-xs font-extrabold tracking-widest text-black uppercase opacity-60">
              False Pos.
            </span>
            <span
              className={`font-neo text-lg font-black whitespace-nowrap ${falsePositives > 0 ? 'text-black opacity-50' : 'text-black'}`}
            >
              {falsePositives}
            </span>
          </div>
        </div>
        <div className="mt-auto h-3 w-full overflow-hidden border-4 border-black bg-gray-100">
          {/* eslint-disable-next-line react/forbid-dom-props */}
          <div className="h-full bg-black transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
        <p className="font-neo mt-2 text-center text-[10px] font-extrabold tracking-widest whitespace-nowrap text-black uppercase opacity-60">
          Move {Math.max(0, moveIndex + 1)} / {totalMoves}
        </p>
      </div>
    </div>
  );
}
