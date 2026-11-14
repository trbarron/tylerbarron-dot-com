import { useState } from 'react';
import Button from '~/components/Button';
import Panel from '~/components/Panel';
import Notice from '~/components/Notice';
import Dialog from '~/components/Dialog';
import type { PollView } from '~/utils/bookClub/types';

interface Props {
  poll: PollView;
  token: string;
  busy: boolean;
  act: (body: Record<string, unknown>) => Promise<void>;
}
export default function HostDashboard({ poll, token, busy, act }: Props) {
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState('');
  const [copyError, setCopyError] = useState('');
  const base = typeof window === 'undefined' ? '' : window.location.origin;
  const invite = `${base}/book-club/${poll.id}`;
  const hostLink = `${invite}/host#host=${token}`;
  const participants = poll.participants ?? [];
  const locked = participants.filter((v) => v.locked).length;
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setCopyError('');
    } catch {
      setCopyError('Copy isn’t available here. Select and copy the link from its field.');
    }
  }
  return (
    <div className="space-y-6">
      <Panel title="Invite the club" padded>
        <div className="space-y-4">
          <label className="block text-xs font-bold uppercase" htmlFor="invite-link">
            Voter invite link
          </label>
          <input id="invite-link" className="w-full" readOnly value={invite} onFocus={(e) => e.target.select()} />
          <Button variant="primary" onClick={() => void copy(invite, 'Invite link copied')}>
            Copy invite link
          </Button>
          <details>
            <summary className="cursor-pointer py-3 text-sm font-bold uppercase">Save your private host link</summary>
            <p className="mb-3 text-sm">
              Keep this for returning on another device. Anyone with it can view totals and close voting. Share only the
              voter invite above with your club.
            </p>
            <input
              aria-label="Private host link"
              className="w-full"
              value={hostLink}
              readOnly
              onFocus={(e) => e.target.select()}
            />
            <Button className="mt-3" size="sm" onClick={() => void copy(hostLink, 'Host link copied')}>
              Copy host link
            </Button>
          </details>
          {copied && (
            <p role="status" className="text-sm">
              {copied}.
            </p>
          )}
          {copyError && <Notice tone="info">{copyError}</Notice>}
        </div>
      </Panel>
      <Panel
        title="The room"
        aside={
          <span className="text-sm font-bold">
            {locked}/{participants.length} locked in
          </span>
        }
        subtitle="Updates every five seconds while this tab is visible."
      >
        {participants.length === 0 ? (
          <p className="p-6">The room is empty. Send the invite link to get everyone started.</p>
        ) : (
          <ul>
            {participants.map((v) => (
              <li
                key={v.name}
                className="flex items-center justify-between gap-3 border-b-2 border-black p-4 last:border-0"
              >
                <span className="min-w-0 font-bold break-words">{v.name}</span>
                <span
                  className={`shrink-0 px-3 py-2 text-xs font-bold uppercase ${v.locked ? 'bg-black text-white' : 'bg-neutral-100 text-black'}`}
                >
                  {v.locked ? 'Locked in' : 'Choosing'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {!poll.closed && (
        <Panel title="Ready to call it?" padded>
          <div className="space-y-4">
            <p>Close voting to stop new ballots and reveal the results to everyone with the invite link.</p>
            {locked < participants.length && (
              <p className="font-bold">{participants.length - locked} voter(s) haven’t locked in yet.</p>
            )}
            <Button variant="danger" disabled={busy} onClick={() => setConfirm(true)}>
              Close voting & reveal results
            </Button>
          </div>
        </Panel>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Close voting?">
        <div className="space-y-4 p-5">
          <p>Only locked-in ballots count. Everyone will see the results, and voting can’t be reopened.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setConfirm(false)}>Keep voting open</Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                await act({ kind: 'close' });
                setConfirm(false);
              }}
            >
              Close voting
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
