import Button from '~/components/Button';
interface Props {
  title: string;
  side: 'up' | 'down';
  count: number;
  used: number;
  allowance: number;
  multiple: boolean;
  busy: boolean;
  add: () => void;
  remove: () => void;
}
export default function VoteControls({ title, side, count, used, allowance, multiple, busy, add, remove }: Props) {
  const full = used >= allowance;
  const arrow = side === 'up' ? '↑' : '↓';
  return (
    <div
      className={`flex justify-center gap-1 ${full ? 'bg-neutral-100' : ''}`}
      role="group"
      aria-label={`${side === 'up' ? 'Upvotes' : 'Downvotes'} for ${title}`}
    >
      {multiple && (
        <Button
          size="sm"
          className="px-2"
          aria-label={`Remove ${side}vote from ${title}`}
          disabled={busy || count === 0}
          onClick={remove}
        >
          −
        </Button>
      )}
      <Button
        size="sm"
        className="px-2"
        variant={count > 0 ? 'primary' : 'secondary'}
        aria-label={`${side === 'up' ? 'Upvote' : 'Downvote'} ${title}`}
        aria-pressed={multiple ? undefined : count > 0}
        disabled={busy || (full && (multiple || count === 0))}
        onClick={!multiple && count > 0 ? remove : add}
      >
        {arrow} {multiple ? count : side === 'up' ? '+1' : '−1'}
      </Button>
    </div>
  );
}
