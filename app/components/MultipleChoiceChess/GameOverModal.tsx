import { accuracy } from "~/utils/multipleChoiceChess/scoring";

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
  onPlayAgain: () => void;
}

const REASON_LABELS: Record<string, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  resignation: 'Resignation',
  insufficient_material: 'Insufficient material',
  repetition: 'Threefold repetition',
};

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
  onPlayAgain,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md border-4 border-black bg-white font-neo">
        <div className="border-b-4 border-black p-6 text-center">
          <h2 className="text-3xl font-extrabold uppercase">{headline}</h2>
          <p className="mt-1 text-sm text-gray-600">{REASON_LABELS[reason] ?? reason}</p>
        </div>

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

        <div className="border-t-4 border-black p-4">
          <button
            onClick={onPlayAgain}
            className="w-full border-4 border-black bg-white px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}
