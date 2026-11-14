import { useState } from 'react';
import { useNavigate } from 'react-router';
import Button from '~/components/Button';
import { Checkbox, TextField } from '~/components/Field';
import Panel from '~/components/Panel';
import Notice from '~/components/Notice';
import { bookRequest } from './useBookClub';

export default function CreatePoll() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [books, setBooks] = useState('');
  const [upVotes, setUpVotes] = useState('2');
  const [downVotes, setDownVotes] = useState('1');
  const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Panel title="Create vote" padded>
      <form
        className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const data = await bookRequest({
              kind: 'create',
              upVotes: Number(upVotes),
              downVotes: Number(downVotes),
              allowMultipleVotes,
              title,
              books: books
                .split('\n')
                .map((b) => b.trim())
                .filter(Boolean),
            });
            // The fragment never reaches the server. The host page saves it locally.
            navigate(`/book-club/${data.id}/host#host=${data.hostToken}`);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create your vote.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <TextField
          label="Vote name"
          placeholder="December book club"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div>
          <label htmlFor="book-list" className="mb-1 block text-xs font-bold tracking-wide uppercase">
            Books
          </label>
          <textarea
            id="book-list"
            className="w-full"
            rows={8}
            required
            maxLength={6500}
            value={books}
            onChange={(e) => setBooks(e.target.value)}
            placeholder={'Go Dog Go\nFox in Socks\nA Gentleman in Moscow'}
          />
        </div>
        <div className="flex gap-4">
          <TextField
            className="min-w-0 flex-1"
            label="Upvotes"
            type="number"
            min={0}
            max={30}
            step={1}
            required
            value={upVotes}
            onChange={(e) => setUpVotes(e.target.value)}
          />
          <TextField
            className="min-w-0 flex-1"
            label="Downvotes"
            type="number"
            min={0}
            max={30}
            step={1}
            required
            value={downVotes}
            onChange={(e) => setDownVotes(e.target.value)}
          />
        </div>
        <Checkbox
          label="Allow multiple votes per book"
          checked={allowMultipleVotes}
          onChange={(e) => setAllowMultipleVotes(e.target.checked)}
        />
        {error && <Notice>{error}</Notice>}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create vote'}
        </Button>
      </form>
    </Panel>
  );
}
