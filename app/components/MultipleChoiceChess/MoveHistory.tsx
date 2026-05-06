import { useEffect, useRef } from "react";
import type { MoveHistoryEntry } from "~/utils/multipleChoiceChess/types";
import RankBadge from "./RankBadge";
import SanText from "./SanText";

interface MoveHistoryProps {
  history: MoveHistoryEntry[];
  viewingIndex: number | null;
  onSelectMove: (index: number | null) => void;
  isGameActive: boolean;
}

export default function MoveHistory({
  history,
  viewingIndex,
  onSelectMove,
  isGameActive,
}: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to the latest move when a new move appears, but not while the
  // user is browsing earlier history.
  useEffect(() => {
    if (viewingIndex !== null) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length, viewingIndex]);

  if (history.length === 0) return null;

  const pairs: Array<{ white?: MoveHistoryEntry & { index: number }; black?: MoveHistoryEntry & { index: number } }> = [];
  for (let i = 0; i < history.length; i++) {
    const entry = { ...history[i], index: i };
    if (entry.color === 'white') {
      pairs.push({ white: entry });
    } else {
      const lastPair = pairs[pairs.length - 1];
      if (lastPair && !lastPair.black) {
        lastPair.black = entry;
      } else {
        pairs.push({ black: entry });
      }
    }
  }

  const renderCell = (entry: (MoveHistoryEntry & { index: number }) | undefined) => {
    if (!entry) return <div className="h-9" />;
    const selected = viewingIndex === entry.index;
    return (
      <button
        onClick={() => onSelectMove(entry.index)}
        className={[
          'flex w-full items-center justify-between gap-2 border-2 border-black px-2 py-1 text-left font-bold transition-colors',
          selected ? 'bg-black text-white' : 'bg-white hover:bg-gray-100 active:bg-gray-200',
        ].join(' ')}
      >
        <SanText san={entry.san} />
        <RankBadge rank={entry.rank} inverted={selected} />
      </button>
    );
  };

  return (
    <div className="border-4 border-black bg-white font-neo">
      <div className="flex items-baseline justify-between gap-2 border-b-2 border-black px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wide">Move History</span>
        <span className="text-[10px] uppercase tracking-wide text-gray-500">
          #1 best · #6 worst
        </span>
      </div>

      <div ref={scrollRef} className="max-h-64 overflow-y-auto">
        {pairs.map((pair, pairIdx) => (
          <div
            key={pairIdx}
            className="grid grid-cols-[2rem_1fr_1fr] items-center gap-2 border-b-2 border-black px-2 py-2 last:border-b-0"
          >
            <span className="text-sm text-gray-400">{pairIdx + 1}</span>
            {renderCell(pair.white)}
            {renderCell(pair.black)}
          </div>
        ))}
      </div>

      {!isGameActive && viewingIndex !== null && (
        <div className="border-t-2 border-black px-3 py-1 text-center text-xs text-gray-500">
          Viewing move {viewingIndex + 1} of {history.length}
        </div>
      )}
    </div>
  );
}
