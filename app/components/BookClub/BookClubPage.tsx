import { Link, useParams } from 'react-router';
import { Navbar } from '~/components/Navbar';
import Footer from '~/components/Footer';
import Notice from '~/components/Notice';
import Panel from '~/components/Panel';
import CreatePoll from './CreatePoll';
import Ballot from './Ballot';
import HostDashboard from './HostDashboard';
import { useBookClub } from './useBookClub';

export default function BookClubPage({ host = false }: { host?: boolean }) {
  const { pollId } = useParams();
  return (
    <div className="font-neo relative z-10 min-h-screen text-black">
      <Navbar />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:py-16">
        <header className="space-y-3 border-b-4 border-black pb-6">
          <h1 className="text-4xl font-extrabold tracking-tight uppercase sm:text-6xl">
            <Link to="/book-club">Book club</Link>
          </h1>
          <p className="text-lg">Snazzy voting tool</p>
        </header>
        {pollId ? <ExistingPoll key={`${pollId}:${host}`} id={pollId} host={host} /> : <CreatePoll />}
      </main>
      <Footer />
    </div>
  );
}
function ExistingPoll({ id, host }: { id: string; host: boolean }) {
  const { poll, token, error, busy, act } = useBookClub(id, host);
  return (
    <div className="space-y-6">
      {error && <Notice>{error}</Notice>}
      {!poll && !error && <p role="status">Loading…</p>}
      {poll && (
        <>
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold break-words uppercase">{poll.title}</h2>
          </div>
          {host ? (
            <HostDashboard poll={poll} token={token} busy={busy} act={act} />
          ) : (
            <Ballot poll={poll} busy={busy} act={act} />
          )}
          {poll.closed && poll.results && (
            <Panel title="Results">
              <ol>
                {poll.results.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-4 border-b-2 border-black p-4 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-bold break-words">{b.title}</p>
                      <p className="text-sm text-neutral-600">
                        {b.up} up · {b.down} down
                      </p>
                    </div>
                    <span className="font-mono text-3xl">
                      {b.score > 0 ? '+' : ''}
                      {b.score}
                    </span>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
