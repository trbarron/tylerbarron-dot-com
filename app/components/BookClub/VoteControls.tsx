import Button from '~/components/Button';
interface Props {
  title: string;
  score: number;
  upRemaining: number;
  downRemaining: number;
  multiple: boolean;
  busy: boolean;
  increase: () => void;
  decrease: () => void;
}
export default function VoteControls({
  title,
  score,
  upRemaining,
  downRemaining,
  multiple,
  busy,
  increase,
  decrease,
}: Props) {
  const canIncrease = score < 0 || (upRemaining > 0 && (multiple || score === 0));
  const canDecrease = score > 0 || (downRemaining > 0 && (multiple || score === 0));
  return (
    <div
      role="group"
      aria-label={`Your vote for ${title}`}
      className="grid w-40 shrink-0 grid-cols-3 items-stretch border-2 border-black"
    >
      <Button
        size="sm"
        className="w-full min-w-0 border-0 px-0 text-xl"
        aria-label={`Upvote ${title}`}
        disabled={busy || !canIncrease}
        onClick={increase}
      >
        ↑
      </Button>
      <span
        aria-label={`Your vote: ${score}`}
        className={`flex min-h-12 items-center justify-center border-x-2 border-black font-mono text-xl ${score !== 0 ? 'bg-black text-white' : 'bg-white text-black'}`}
      >
        {score > 0 ? '+' : ''}
        {score}
      </span>
      <Button
        size="sm"
        className="w-full min-w-0 border-0 px-0 text-xl"
        aria-label={`Downvote ${title}`}
        disabled={busy || !canDecrease}
        onClick={decrease}
      >
        ↓
      </Button>
    </div>
  );
}
