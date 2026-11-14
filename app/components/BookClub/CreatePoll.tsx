import { useState } from 'react';
import { useNavigate } from 'react-router';
import Button from '~/components/Button';
import { TextField } from '~/components/Field';
import Panel from '~/components/Panel';
import Notice from '~/components/Notice';
import { bookRequest } from './useBookClub';

export default function CreatePoll() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [books, setBooks] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Panel title="Build your shortlist" padded>
      <form
        className="space-y-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            const data = await bookRequest({
              kind: 'create',
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
          label="Name this vote"
          placeholder="December book club"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div>
          <label htmlFor="book-list" className="mb-1 block text-xs font-bold tracking-wide uppercase">
            The books
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
            aria-describedby="book-list-hint"
          />
          <p id="book-list-hint" className="mt-2 text-sm text-neutral-600">
            One book per line. Add 3–30 books; include authors if you like. The list is fixed once created.
          </p>
        </div>
        {error && <Notice>{error}</Notice>}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create a book vote'}
        </Button>
        <p className="text-sm text-neutral-600">
          No accounts. Each person gets two upvotes and one downvote. Votes and names expire 30 days after creation.
        </p>
      </form>
    </Panel>
  );
}
