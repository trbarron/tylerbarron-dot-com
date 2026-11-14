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
      <Panel title="Invite voters" padded>
        <div className="space-y-4">
          <label className="block text-xs font-bold uppercase" htmlFor="invite-link">
            Voter invite link
          </label>
          <input id="invite-link" className="w-full" readOnly value={invite} onFocus={(e) => e.target.select()} />
          <Button variant="primary" onClick={() => void copy(invite, 'Invite link copied')}>
            Copy invite link
          </Button>
          <details>
            <summary className="cursor-pointer py-3 text-sm font-bold uppercase">Host link</summary>
            <p className="mb-3 text-sm">this should generally not be shared</p>
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
        title="Voters"
        aside={
          <span className="text-sm font-bold">
            {locked}/{participants.length} locked in
          </span>
        }
      >
        {participants.length === 0 ? (
          <p className="p-6">No voters yet.</p>
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
        <Panel title="Close voting" padded>
          <div className="space-y-4">
            {locked < participants.length && <p className="font-bold">{participants.length - locked} votes pending.</p>}
            <Button variant="danger" disabled={busy} onClick={() => setConfirm(true)}>
              Close voting & reveal results
            </Button>
          </div>
        </Panel>
      )}
      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Close voting?">
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3">
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
