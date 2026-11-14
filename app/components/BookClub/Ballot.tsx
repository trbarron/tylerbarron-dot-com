import { useState } from 'react';
import Button from '~/components/Button';
import { TextField } from '~/components/Field';
import Panel from '~/components/Panel';
import Dialog from '~/components/Dialog';
import type { PollView } from '~/utils/bookClub/types';

interface Props {
  poll: PollView;
  busy: boolean;
  act: (body: Record<string, unknown>) => Promise<void>;
}
export default function Ballot({ poll, busy, act }: Props) {
  const [name, setName] = useState('');
  const [up, setUp] = useState<string[]>([]);
  const [down, setDown] = useState('');
  const [confirm, setConfirm] = useState(false);
  if (!poll.self && !poll.closed)
    return (
      <Panel title="Join vote" padded>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void act({ kind: 'join', name });
          }}
        >
          <TextField
            label="Your name"
            autoComplete="name"
            maxLength={40}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'Joining…' : 'Join the vote'}
          </Button>
        </form>
      </Panel>
    );
  const locked = poll.self?.ballot;
  if (locked || poll.closed)
    return (
      <Panel title={locked ? 'Locked in' : 'Voting is closed'} padded>
        {locked ? (
          <div className="space-y-3">
            {poll.books
              .filter((b) => locked.up.includes(b.id) || locked.down === b.id)
              .map((b) => (
                <p key={b.id} className="border-t-2 border-black pt-3">
                  <strong>{locked.up.includes(b.id) ? '+1' : '−1'}</strong> · {b.title}
                </p>
              ))}
            {!poll.closed && <p className="text-sm text-neutral-600">Results available when voting closes.</p>}
          </div>
        ) : (
          <p>Voting closed.</p>
        )}
      </Panel>
    );
  const complete = up.length === 2 && Boolean(down);
  return (
    <Panel title={`${poll.self?.name}’s ballot`} subtitle="Two books up. One book down.">
      <div className="border-b-2 border-black bg-neutral-100 p-4" aria-live="polite">
        {up.length}/2 upvotes · {down ? '1' : '0'}/1 downvote
      </div>
      <ul>
        {poll.books.map((book, index) => (
          <li key={book.id} className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black p-4">
            <div className="min-w-0 flex-1">
              <span className="text-xs text-neutral-500">{String(index + 1).padStart(2, '0')}</span>
              <p className="text-lg font-bold break-words">{book.title}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={up.includes(book.id) ? 'primary' : 'secondary'}
                aria-label={`Upvote ${book.title}`}
                aria-pressed={up.includes(book.id)}
                disabled={busy || (!up.includes(book.id) && up.length === 2)}
                onClick={() => {
                  setUp(up.includes(book.id) ? up.filter((id) => id !== book.id) : [...up, book.id]);
                  if (down === book.id) setDown('');
                }}
              >
                ↑ +1
              </Button>
              <Button
                size="sm"
                variant={down === book.id ? 'primary' : 'secondary'}
                aria-label={`Downvote ${book.title}`}
                aria-pressed={down === book.id}
                disabled={busy}
                onClick={() => {
                  setDown(down === book.id ? '' : book.id);
                  setUp(up.filter((id) => id !== book.id));
                }}
              >
                ↓ −1
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="space-y-3 p-4">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          disabled={!complete || busy}
          onClick={() => setConfirm(true)}
        >
          Lock in my votes
        </Button>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Lock in your votes?">
        <div className="space-y-4 p-5">
          {poll.books
            .filter((b) => up.includes(b.id) || down === b.id)
            .map((b) => (
              <p key={b.id}>
                <strong>{up.includes(b.id) ? '+1' : '−1'}</strong> · {b.title}
              </p>
            ))}
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => setConfirm(false)}>Keep choosing</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                await act({ kind: 'vote', ballot: { up, down } });
                setConfirm(false);
              }}
            >
              {busy ? 'Saving…' : 'Lock in votes'}
            </Button>
          </div>
        </div>
      </Dialog>
    </Panel>
  );
}
