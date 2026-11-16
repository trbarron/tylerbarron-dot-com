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
    <div role="group" aria-label={`Your vote for ${title}`} className="flex shrink-0 items-stretch gap-2">
      <Button
        size="sm"
        className="w-12"
        variant={score > 0 ? 'primary' : 'secondary'}
        aria-label={`Upvote ${title}`}
        disabled={busy}
        aria-disabled={busy || !canIncrease}
        onClick={() => {
          if (canIncrease) increase();
        }}
      >
        ↑
      </Button>
      <span aria-label={`Your vote: ${score}`} className="flex w-10 items-center justify-center font-mono text-xl">
        {score > 0 ? '+' : ''}
        {score}
      </span>
      <Button
        size="sm"
        className="w-12"
        variant={score < 0 ? 'primary' : 'secondary'}
        aria-label={`Downvote ${title}`}
        disabled={busy}
        aria-disabled={busy || !canDecrease}
        onClick={() => {
          if (canDecrease) decrease();
        }}
      >
        ↓
      </Button>
    </div>
  );
}
