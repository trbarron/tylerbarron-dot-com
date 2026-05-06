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
  onReview: () => void;
}

const REASON_LABELS: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  resignation: 'Resignation',
  insufficient_material: 'Insufficient material',
  repetition: 'Threefold repetition',
};

const RANK_BADGE: Record<number, string> = {
  1: 'bg-white text-black border-black',
  2: 'bg-gray-200 text-gray-900 border-gray-500',
  4: 'bg-gray-600 text-white border-gray-800',
  6: 'bg-black text-white border-black',
};

const RANK_LABEL: Record<number, string> = {
  1: '#1',
  2: '#2',
  4: '#4',
  6: '#6',
};

function StatRow({ rank, count }: { rank: number; count: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <span className={`shrink-0 border-2 px-1 text-xs leading-none py-0.5 ${RANK_BADGE[rank]}`}>
        {RANK_LABEL[rank]}
      </span>
      <span className="font-bold text-black">{count}</span>
    </div>
  );
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
  onReview,
}: GameOverModalProps) {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onReview}>
      <div className="w-full max-w-md border-4 border-black bg-white font-neo" onClick={(e) => e.stopPropagation()}>
        <div className="border-b-4 border-black p-6 text-center">
          <h2 className="text-3xl font-extrabold uppercase">{headline}</h2>
          <p className="mt-1 text-sm text-gray-600">{REASON_LABELS[reason] ?? reason}</p>
        </div>

        <div className="grid grid-cols-2 divide-x-4 divide-black">
          <div className="p-5">
            <div className="text-xs font-bold uppercase text-gray-500">You ({myColor})</div>
            <div className="mt-2 space-y-1">
              <StatRow rank={1} count={myRanks.rank1} />
              <StatRow rank={2} count={myRanks.rank2} />
              <StatRow rank={4} count={myRanks.rank4} />
              <StatRow rank={6} count={myRanks.rank6} />
            </div>
            <div className="mt-2 text-sm text-gray-600">{myAcc}% accuracy</div>
            <div className="text-xs text-gray-400">{myMoves} moves</div>
          </div>
          <div className="p-5">
            <div className="text-xs font-bold uppercase text-gray-500">
              Opponent ({myColor === 'white' ? 'black' : 'white'})
            </div>
            <div className="mt-2 space-y-1">
              <StatRow rank={1} count={oppRanks.rank1} />
              <StatRow rank={2} count={oppRanks.rank2} />
              <StatRow rank={4} count={oppRanks.rank4} />
              <StatRow rank={6} count={oppRanks.rank6} />
            </div>
            <div className="mt-2 text-sm text-gray-600">{oppAcc}% accuracy</div>
            <div className="text-xs text-gray-400">{oppMoves} moves</div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x-4 divide-black border-t-4 border-black">
          {moveHistory.length > 0 ? (
            <button
              onClick={onReview}
              className="px-4 py-3 font-bold uppercase text-sm hover:bg-black hover:text-white active:bg-black active:text-white"
            >
              Review Game →
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={onPlayAgain}
            className="px-4 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white active:bg-black active:text-white"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
