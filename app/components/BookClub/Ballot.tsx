import { useState } from 'react';
import Button from '~/components/Button';
import { TextField } from '~/components/Field';
import Panel from '~/components/Panel';
import Dialog from '~/components/Dialog';
import VoteControls from './VoteControls';
import { normalizeBallot, type PollView } from '~/utils/bookClub/types';

interface Props {
  poll: PollView;
  busy: boolean;
  act: (body: Record<string, unknown>) => Promise<void>;
}
export default function Ballot({ poll, busy, act }: Props) {
  const [name, setName] = useState('');
  const [up, setUp] = useState<string[]>([]);
  const [down, setDown] = useState<string[]>([]);
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
  const locked = normalizeBallot(poll.self?.ballot);
  const upVotes = poll.upVotes ?? 2;
  const downVotes = poll.downVotes ?? 1;
  if (locked || poll.closed)
    return (
      <Panel title={locked ? 'Locked in' : 'Voting is closed'} padded>
        {locked ? (
          <div className="space-y-3">
            {locked.up.length + locked.down.length === 0 && <p>No votes selected.</p>}
            {poll.books
              .filter((b) => locked.up.includes(b.id) || locked.down.includes(b.id))
              .map((b) => (
                <p key={b.id} className="border-t-2 border-black pt-3">
                  <strong>
                    {locked.up.includes(b.id)
                      ? `+${locked.up.filter((id) => id === b.id).length}`
                      : `−${locked.down.filter((id) => id === b.id).length}`}
                  </strong>{' '}
                  · {b.title}
                </p>
              ))}
            {!poll.closed && <p className="text-sm text-neutral-600">Results available when voting closes.</p>}
          </div>
        ) : (
          <p>Voting closed.</p>
        )}
      </Panel>
    );
  return (
    <Panel title={`${poll.self?.name}’s ballot`}>
      <div className="border-b-2 border-black bg-neutral-100 p-4" aria-live="polite">
        {upVotes - up.length} {upVotes - up.length === 1 ? 'upvote' : 'upvotes'} left · {downVotes - down.length}{' '}
        {downVotes - down.length === 1 ? 'downvote' : 'downvotes'} left
      </div>
      <ul>
        {poll.books.map((book) => (
          <li key={book.id} className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black p-4">
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold break-words">{book.title}</p>
            </div>
            <VoteControls
              title={book.title}
              score={up.filter((id) => id === book.id).length - down.filter((id) => id === book.id).length}
              upRemaining={upVotes - up.length}
              downRemaining={downVotes - down.length}
              multiple={poll.allowMultipleVotes ?? false}
              busy={busy}
              increase={() => {
                if (down.includes(book.id)) {
                  const next = [...down];
                  next.splice(next.indexOf(book.id), 1);
                  setDown(next);
                } else setUp([...up, book.id]);
              }}
              decrease={() => {
                if (up.includes(book.id)) {
                  const next = [...up];
                  next.splice(next.indexOf(book.id), 1);
                  setUp(next);
                } else setDown([...down, book.id]);
              }}
            />
          </li>
        ))}
      </ul>
      <div className="space-y-3 p-4">
        <Button variant="primary" size="lg" className="w-full" disabled={busy} onClick={() => setConfirm(true)}>
          Lock in my votes
        </Button>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Lock in your votes?">
        <div className="space-y-4 p-5">
          {up.length + down.length === 0 && <p>No votes selected.</p>}
          {poll.books
            .filter((b) => up.includes(b.id) || down.includes(b.id))
            .map((b) => (
              <p key={b.id}>
                <strong>
                  {up.includes(b.id)
                    ? `+${up.filter((id) => id === b.id).length}`
                    : `−${down.filter((id) => id === b.id).length}`}
                </strong>{' '}
                · {b.title}
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
