import type { MoveHistoryEntry } from "~/routes/multipleChoiceChess.$gameId.$playerId";

const RANK_LABELS: Record<number, string> = {
  1: '#1',
  2: '#2',
  4: '#4',
  6: '#6',
};

const RANK_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-800 border-green-400',
  2: 'bg-yellow-100 text-yellow-800 border-yellow-400',
  4: 'bg-orange-100 text-orange-800 border-orange-400',
  6: 'bg-red-100 text-red-800 border-red-400',
};

interface MoveHistoryProps {
  history: MoveHistoryEntry[];
  viewingIndex: number | null;
  onSelectMove: (index: number | null) => void;
  isGameActive: boolean;
}

function SanText({ san }: { san: string }) {
  const idx = san.indexOf('x');
  if (idx === -1) {
    return <span className="uppercase">{san}</span>;
  }
  return (
    <span className="inline-flex items-center uppercase leading-none">
      <span>{san.slice(0, idx)}</span>
      <span className="text-[0.7em] mx-px">x</span>
      <span>{san.slice(idx + 1)}</span>
    </span>
  );
}

export default function MoveHistory({
  history,
  viewingIndex,
  onSelectMove,
  isGameActive,
}: MoveHistoryProps) {
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
        <span
          className={[
            'shrink-0 border-2 px-1 text-xs leading-none py-0.5',
            selected
              ? 'bg-white text-black border-white'
              : RANK_COLORS[entry.rank] ?? 'bg-gray-100 text-gray-600 border-gray-300',
          ].join(' ')}
        >
          {RANK_LABELS[entry.rank] ?? `#${entry.rank}`}
        </span>
      </button>
    );
  };

  return (
    <div className="border-4 border-black bg-white font-neo">
      <div className="flex items-center justify-between border-b-2 border-black px-3 py-2">
        <span className="text-xs font-bold uppercase tracking-wide">Move History</span>
        {viewingIndex !== null && (
          <button
            onClick={() => onSelectMove(null)}
            className="border-2 border-black px-2 py-0.5 text-xs font-bold uppercase hover:bg-black hover:text-white active:bg-black active:text-white"
          >
            ↓ Live
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-y-auto">
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
