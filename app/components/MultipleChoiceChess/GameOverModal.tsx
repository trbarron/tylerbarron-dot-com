import { useState } from "react";
import { accuracy } from "~/utils/multipleChoiceChess/scoring";
import type { MoveHistoryEntry } from "~/routes/multipleChoiceChess.$gameId.$playerId";

interface GameOverModalProps {
  result: 'white' | 'black' | 'draw';
  reason: string;
  myColor: 'white' | 'black';
  whiteRank1: number;
  whiteRank2: number;
  whiteRank4: number;
  whiteRank6: number;
  blackRank1: number;
  blackRank2: number;
  blackRank4: number;
  blackRank6: number;
  moveHistory: MoveHistoryEntry[];
  onPlayAgain: () => void;
}

const REASON_LABELS: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  resignation: 'Resignation',
  insufficient_material: 'Insufficient material',
  repetition: 'Threefold repetition',
};

const RANK_LABELS: Record<number, string> = {
  1: 'Best',
  2: '2nd',
  4: '4th',
  6: '6th',
};

const RANK_BADGE: Record<number, string> = {
  1: 'bg-green-100 text-green-800 border-green-400',
  2: 'bg-yellow-100 text-yellow-800 border-yellow-400',
  4: 'bg-orange-100 text-orange-800 border-orange-400',
  6: 'bg-red-100 text-red-800 border-red-400',
};

function lichessUrl(fen: string): string {
  return `https://lichess.org/analysis?fen=${encodeURIComponent(fen)}`;
}

export default function GameOverModal({
  result,
  reason,
  myColor,
  whiteRank1,
  whiteRank2,
  whiteRank4,
  whiteRank6,
  blackRank1,
  blackRank2,
  blackRank4,
  blackRank6,
  moveHistory,
  onPlayAgain,
}: GameOverModalProps) {
  const [showMoveList, setShowMoveList] = useState(false);

  const didWin = result === myColor;
  const isDraw = result === 'draw';

  const myRanks = myColor === 'white'
    ? { rank1: whiteRank1, rank2: whiteRank2, rank4: whiteRank4, rank6: whiteRank6 }
    : { rank1: blackRank1, rank2: blackRank2, rank4: blackRank4, rank6: blackRank6 };
  const oppRanks = myColor === 'white'
    ? { rank1: blackRank1, rank2: blackRank2, rank4: blackRank4, rank6: blackRank6 }
    : { rank1: whiteRank1, rank2: whiteRank2, rank4: whiteRank4, rank6: whiteRank6 };

  const myScore = (myRanks.rank1 * 1) + (myRanks.rank2 * 2) + (myRanks.rank4 * 4) + (myRanks.rank6 * 6);
  const oppScore = (oppRanks.rank1 * 1) + (oppRanks.rank2 * 2) + (oppRanks.rank4 * 4) + (oppRanks.rank6 * 6);
  const myMoves = myRanks.rank1 + myRanks.rank2 + myRanks.rank4 + myRanks.rank6;
  const oppMoves = oppRanks.rank1 + oppRanks.rank2 + oppRanks.rank4 + oppRanks.rank6;
  const myAcc = accuracy(myScore, myMoves);
  const oppAcc = accuracy(oppScore, oppMoves);

  const headline = isDraw ? 'Draw' : didWin ? 'You win!' : 'You lose';

  // Group moves into pairs for display
  const movePairs: Array<{ white?: MoveHistoryEntry & { index: number }; black?: MoveHistoryEntry & { index: number } }> = [];
  for (let i = 0; i < moveHistory.length; i++) {
    const entry = { ...moveHistory[i], index: i };
    if (entry.color === 'white') {
      movePairs.push({ white: entry });
    } else {
      const lastPair = movePairs[movePairs.length - 1];
      if (lastPair && !lastPair.black) {
        lastPair.black = entry;
      } else {
        movePairs.push({ black: entry });
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md border-4 border-black bg-white font-neo max-h-[90vh] flex flex-col">
        <div className="border-b-4 border-black p-6 text-center shrink-0">
          <h2 className="text-3xl font-extrabold uppercase">{headline}</h2>
          <p className="mt-1 text-sm text-gray-600">{REASON_LABELS[reason] ?? reason}</p>
        </div>

        {!showMoveList ? (
          <>
            <div className="grid grid-cols-2 divide-x-4 divide-black p-0">
              <div className="p-5">
                <div className="text-xs font-bold uppercase text-gray-500">You ({myColor})</div>
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  <div>#1 picks: <span className="font-bold text-black">{myRanks.rank1}</span></div>
                  <div>#2 picks: <span className="font-bold text-black">{myRanks.rank2}</span></div>
                  <div>#4 picks: <span className="font-bold text-black">{myRanks.rank4}</span></div>
                  <div>#6 picks: <span className="font-bold text-black">{myRanks.rank6}</span></div>
                </div>
                <div className="mt-1 text-sm text-gray-600">{myAcc}% accuracy</div>
                <div className="text-xs text-gray-400">{myMoves} moves</div>
              </div>
              <div className="p-5">
                <div className="text-xs font-bold uppercase text-gray-500">
                  Opponent ({myColor === 'white' ? 'black' : 'white'})
                </div>
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  <div>#1 picks: <span className="font-bold text-black">{oppRanks.rank1}</span></div>
                  <div>#2 picks: <span className="font-bold text-black">{oppRanks.rank2}</span></div>
                  <div>#4 picks: <span className="font-bold text-black">{oppRanks.rank4}</span></div>
                  <div>#6 picks: <span className="font-bold text-black">{oppRanks.rank6}</span></div>
                </div>
                <div className="mt-1 text-sm text-gray-600">{oppAcc}% accuracy</div>
                <div className="text-xs text-gray-400">{oppMoves} moves</div>
              </div>
            </div>

            {moveHistory.length > 0 && (
              <div className="border-t-4 border-black px-4 py-3 shrink-0">
                <button
                  onClick={() => setShowMoveList(true)}
                  className="w-full border-2 border-black px-4 py-2 font-bold uppercase text-sm hover:bg-black hover:text-white active:bg-black active:text-white"
                >
                  Review Moves →
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col min-h-0 flex-1">
            <div className="border-b-2 border-black px-4 py-2 flex items-center justify-between shrink-0">
              <button
                onClick={() => setShowMoveList(false)}
                className="text-sm font-bold uppercase border-2 border-black px-2 py-0.5 hover:bg-black hover:text-white active:bg-black active:text-white"
              >
                ← Back
              </button>
              <span className="text-xs font-bold uppercase text-gray-500">Move Review</span>
            </div>

            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b-2 border-black">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs text-gray-400 font-normal w-8">#</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-400 font-normal">White</th>
                    <th className="px-2 py-2 text-left text-xs text-gray-400 font-normal">Black</th>
                  </tr>
                </thead>
                <tbody>
                  {movePairs.map((pair, pairIdx) => (
                    <tr key={pairIdx} className="border-b border-gray-100 last:border-0">
                      <td className="px-3 py-2 text-xs text-gray-400">{pairIdx + 1}</td>
                      <td className="px-2 py-2">
                        {pair.white && (
                          <MoveCell entry={pair.white} myColor={myColor} />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {pair.black && (
                          <MoveCell entry={pair.black} myColor={myColor} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="border-t-4 border-black p-4 shrink-0">
          <button
            onClick={onPlayAgain}
            className="w-full border-4 border-black bg-white px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white active:bg-black active:text-white"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}

function MoveCell({ entry, myColor }: { entry: MoveHistoryEntry & { index: number }; myColor: 'white' | 'black' }) {
  const isMe = entry.color === myColor;
  const badgeClass = RANK_BADGE[entry.rank] ?? 'bg-gray-100 text-gray-600 border-gray-300';
  const rankLabel = RANK_LABELS[entry.rank] ?? `#${entry.rank}`;

  return (
    <div className="flex items-center gap-1.5">
      <span className={`font-bold ${isMe ? 'text-black' : 'text-gray-500'}`}>
        {entry.san}
      </span>
      <span className={`text-xs border rounded px-1 py-0.5 shrink-0 ${badgeClass}`}>
        {rankLabel}
      </span>
      <a
        href={lichessUrl(entry.fenBefore)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 hover:underline shrink-0"
        title="Analyze on Lichess"
      >
        ♟
      </a>
    </div>
  );
}
