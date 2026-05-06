import type { MoveHistoryEntry } from "~/utils/multipleChoiceChess/types";
import { accuracy, pointsForRank } from "~/utils/multipleChoiceChess/scoring";
import RankBadge from "./RankBadge";

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
  abandonment: 'Opponent left',
  insufficient_material: 'Insufficient material',
  repetition: 'Threefold repetition',
};

function StatRow({ rank, count }: { rank: number; count: number }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-700">
      <RankBadge rank={rank} />
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

  // Accuracy is computed from ranked moves only; fallback (rank 0) moves
  // are excluded by construction since they aren't in any rank counter.
  const computeAccuracy = (r: { rank1: number; rank2: number; rank4: number; rank6: number }) => {
    const moves = r.rank1 + r.rank2 + r.rank4 + r.rank6;
    const score =
      r.rank1 * pointsForRank(1) +
      r.rank2 * pointsForRank(2) +
      r.rank4 * pointsForRank(4) +
      r.rank6 * pointsForRank(6);
    return accuracy(score, moves);
  };

  const myAccuracy = computeAccuracy(myRanks);
  const oppAccuracy = computeAccuracy(oppRanks);

  const headline = isDraw ? 'Draw' : didWin ? 'You win!' : 'You lose';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md border-4 border-black bg-white font-neo">
        <div className="border-b-4 border-black p-6 text-center">
          <h2 className="text-3xl font-extrabold uppercase">{headline}</h2>
          <p className="mt-1 text-sm text-gray-600">{REASON_LABELS[reason] ?? reason}</p>
        </div>

        <div className="px-5 pt-3 pb-1 text-center text-[10px] uppercase tracking-wide text-gray-500">
          #1 best engine pick · #6 worst
        </div>

        <div className="grid grid-cols-2 divide-x-4 divide-black">
          <div className="p-5">
            <div className="text-xs font-bold uppercase text-gray-500">You ({myColor})</div>
            <div className="mt-1 text-2xl font-extrabold leading-none text-black">{myAccuracy}%</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">accuracy</div>
            <div className="mt-3 space-y-1">
              <StatRow rank={1} count={myRanks.rank1} />
              <StatRow rank={2} count={myRanks.rank2} />
              <StatRow rank={4} count={myRanks.rank4} />
              <StatRow rank={6} count={myRanks.rank6} />
            </div>
          </div>
          <div className="p-5">
            <div className="text-xs font-bold uppercase text-gray-500">
              Opponent ({myColor === 'white' ? 'black' : 'white'})
            </div>
            <div className="mt-1 text-2xl font-extrabold leading-none text-black">{oppAccuracy}%</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-400">accuracy</div>
            <div className="mt-3 space-y-1">
              <StatRow rank={1} count={oppRanks.rank1} />
              <StatRow rank={2} count={oppRanks.rank2} />
              <StatRow rank={4} count={oppRanks.rank4} />
              <StatRow rank={6} count={oppRanks.rank6} />
            </div>
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
