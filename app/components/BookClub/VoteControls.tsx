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
  const label = side === 'up' ? 'Upvotes' : 'Downvotes';
  return (
    <div role="group" aria-label={`${label} for ${title}`} className="min-w-0 space-y-2">
      <div className="text-center text-xs font-bold uppercase">{label}</div>
      <div className="grid grid-cols-3 items-stretch border-2 border-black">
        <Button
          size="sm"
          className="w-full min-w-0 border-0 px-0"
          aria-label={`Remove ${side}vote from ${title}`}
          disabled={busy || count === 0}
          onClick={remove}
        >
          −
        </Button>
        <span
          aria-label={`${count} ${side}votes assigned to ${title}`}
          className={`flex min-h-12 items-center justify-center border-x-2 border-black font-mono text-2xl ${count > 0 ? 'bg-black text-white' : 'bg-white text-black'}`}
        >
          {count}
        </span>
        <Button
          size="sm"
          className="w-full min-w-0 border-0 px-0"
          aria-label={`${side === 'up' ? 'Upvote' : 'Downvote'} ${title}`}
          disabled={busy || used >= allowance || (!multiple && count > 0)}
          onClick={add}
        >
          +
        </Button>
      </div>
    </div>
  );
}
