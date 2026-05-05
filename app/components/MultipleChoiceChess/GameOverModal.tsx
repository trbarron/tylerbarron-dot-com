import { accuracy } from "~/utils/multipleChoiceChess/scoring";

interface GameOverModalProps {
  result: 'white' | 'black' | 'draw';
  reason: string;
  myColor: 'white' | 'black';
  whiteScore: number;
  blackScore: number;
  whiteMoves: number;
  blackMoves: number;
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
  whiteScore,
  blackScore,
  whiteMoves,
  blackMoves,
  onPlayAgain,
}: GameOverModalProps) {
  const didWin = result === myColor;
  const isDraw = result === 'draw';

  const myScore = myColor === 'white' ? whiteScore : blackScore;
  const oppScore = myColor === 'white' ? blackScore : whiteScore;
  const myMoves = myColor === 'white' ? whiteMoves : blackMoves;
  const oppMoves = myColor === 'white' ? blackMoves : whiteMoves;

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
            <div className="mt-1 text-4xl font-extrabold">{myScore} pts</div>
            <div className="mt-1 text-sm text-gray-600">{myAcc}% accuracy</div>
            <div className="text-xs text-gray-400">{myMoves} moves</div>
          </div>
          <div className="p-5">
            <div className="text-xs font-bold uppercase text-gray-500">
              Opponent ({myColor === 'white' ? 'black' : 'white'})
            </div>
            <div className="mt-1 text-4xl font-extrabold">{oppScore} pts</div>
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
