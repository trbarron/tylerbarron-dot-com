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
  viewingIndex: number | null; // null = current position
  onSelectMove: (index: number | null) => void;
  isGameActive: boolean;
}

export default function MoveHistory({
  history,
  viewingIndex,
  onSelectMove,
  isGameActive,
}: MoveHistoryProps) {
  if (history.length === 0) return null;

  // Group into pairs: [white_move, black_move]
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

  return (
    <div className="border-4 border-black bg-white font-neo">
      <div className="border-b-2 border-black px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide">Move History</span>
        {viewingIndex !== null && (
          <button
            onClick={() => onSelectMove(null)}
            className="text-xs font-bold uppercase border-2 border-black px-2 py-0.5 hover:bg-black hover:text-white active:bg-black active:text-white"
          >
            ↓ Live
          </button>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-2 py-1 text-left text-xs text-gray-400 font-normal w-8">#</th>
              <th className="px-2 py-1 text-left text-xs text-gray-400 font-normal w-1/2">White</th>
              <th className="px-2 py-1 text-left text-xs text-gray-400 font-normal w-1/2">Black</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((pair, pairIdx) => (
              <tr key={pairIdx} className="border-b border-gray-100 last:border-0">
                <td className="px-2 py-1 text-xs text-gray-400">{pairIdx + 1}</td>
                <td className="px-1 py-1">
                  {pair.white ? (
                    <button
                      onClick={() => onSelectMove(pair.white!.index)}
                      className={[
                        'flex items-center gap-1 rounded px-1 py-0.5 text-left w-full transition-colors',
                        viewingIndex === pair.white.index
                          ? 'bg-black text-white'
                          : 'hover:bg-gray-100 active:bg-gray-200',
                      ].join(' ')}
                    >
                      <span className="font-bold">{pair.white.san}</span>
                      <span className={[
                        'text-xs border rounded px-0.5 shrink-0',
                        viewingIndex === pair.white.index
                          ? 'bg-white text-black border-white'
                          : RANK_COLORS[pair.white.rank] ?? 'bg-gray-100 text-gray-600 border-gray-300',
                      ].join(' ')}>
                        {RANK_LABELS[pair.white.rank] ?? `#${pair.white.rank}`}
                      </span>
                    </button>
                  ) : null}
                </td>
                <td className="px-1 py-1">
                  {pair.black ? (
                    <button
                      onClick={() => onSelectMove(pair.black!.index)}
                      className={[
                        'flex items-center gap-1 rounded px-1 py-0.5 text-left w-full transition-colors',
                        viewingIndex === pair.black.index
                          ? 'bg-black text-white'
                          : 'hover:bg-gray-100 active:bg-gray-200',
                      ].join(' ')}
                    >
                      <span className="font-bold">{pair.black.san}</span>
                      <span className={[
                        'text-xs border rounded px-0.5 shrink-0',
                        viewingIndex === pair.black.index
                          ? 'bg-white text-black border-white'
                          : RANK_COLORS[pair.black.rank] ?? 'bg-gray-100 text-gray-600 border-gray-300',
                      ].join(' ')}>
                        {RANK_LABELS[pair.black.rank] ?? `#${pair.black.rank}`}
                      </span>
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!isGameActive && viewingIndex !== null && (
        <div className="border-t-2 border-black px-3 py-1 text-xs text-gray-500 text-center">
          Viewing move {viewingIndex + 1} of {history.length}
        </div>
      )}
    </div>
  );
}
