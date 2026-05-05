import { accuracy } from "~/utils/multipleChoiceChess/scoring";

interface ScorePanelProps {
  myColor: 'white' | 'black';
  whiteScore: number;
  blackScore: number;
  whiteMoves: number;
  blackMoves: number;
  turn: 'white' | 'black';
}

export default function ScorePanel({
  myColor,
  whiteScore,
  blackScore,
  whiteMoves,
  blackMoves,
  turn,
}: ScorePanelProps) {
  const opponentColor = myColor === 'white' ? 'black' : 'white';
  const myScore = myColor === 'white' ? whiteScore : blackScore;
  const oppScore = myColor === 'white' ? blackScore : whiteScore;
  const myMoves = myColor === 'white' ? whiteMoves : blackMoves;
  const oppMoves = myColor === 'white' ? blackMoves : whiteMoves;

  const myAcc = accuracy(myScore, myMoves);
  const oppAcc = accuracy(oppScore, oppMoves);

  return (
    <div className="border-4 border-black bg-white font-neo">
      <div className="border-b-4 border-black px-4 py-2 font-bold uppercase">Score</div>
      <div className="grid grid-cols-2 divide-x-4 divide-black">
        <div className={`p-4 ${turn === myColor ? 'bg-yellow-100' : ''}`}>
          <div className="text-xs font-bold uppercase text-gray-500">
            You ({myColor})
            {turn === myColor && <span className="ml-1 text-black">← turn</span>}
          </div>
          <div className="mt-1 text-3xl font-extrabold">{myScore}</div>
          <div className="text-sm text-gray-600">{myAcc}% accuracy</div>
          <div className="text-xs text-gray-400">{myMoves} moves</div>
        </div>
        <div className={`p-4 ${turn === opponentColor ? 'bg-yellow-100' : ''}`}>
          <div className="text-xs font-bold uppercase text-gray-500">
            Opponent ({opponentColor})
            {turn === opponentColor && <span className="ml-1 text-black">← turn</span>}
          </div>
          <div className="mt-1 text-3xl font-extrabold">{oppScore}</div>
          <div className="text-sm text-gray-600">{oppAcc}% accuracy</div>
          <div className="text-xs text-gray-400">{oppMoves} moves</div>
        </div>
      </div>
    </div>
  );
}
