import { RANK_COLORS, RANK_LABELS, pointsForRank } from "~/utils/multipleChoiceChess/scoring";

interface ResultFeedbackProps {
  rank: number;
  san: string;
  isMyMove: boolean;
}

export default function ResultFeedback({ rank, san, isMyMove }: ResultFeedbackProps) {
  const colorClass = RANK_COLORS[rank] ?? 'bg-gray-200 text-black';
  const label = RANK_LABELS[rank] ?? '';
  const points = pointsForRank(rank);

  return (
    <div className={`border-4 border-black p-4 font-neo ${colorClass}`}>
      <div className="font-extrabold uppercase">
        {isMyMove ? `You played ${san}` : `Opponent played ${san}`}
      </div>
      <div className="mt-1 text-sm font-bold">
        {label} · {points} point{points !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
