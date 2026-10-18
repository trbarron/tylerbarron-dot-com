import { useCallback, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import { Link, useLoaderData, useLocation, type LinksFunction } from 'react-router';
import { Navbar } from '~/components/Navbar';
import Footer from '~/components/Footer';
import ChessBoard from '~/components/CollaborativeCheckmate/ChessBoard';
import GameControls from '~/components/CollaborativeCheckmate/GameControls';
import PlayerSeats from '~/components/CollaborativeCheckmate/PlayerSeats';
import GameLog, { type GameLogEntry } from '~/components/CollaborativeCheckmate/GameLog';
import { useCollaborativeCheckmate } from '~/hooks/useCollaborativeCheckmate';
import { SEATS, teamOf, type SeatKey } from '~/utils/collaborativeCheckmate/types';
import chessgroundBase from '../styles/chessground.base.css?url';
import chessgroundBrown from '../styles/chessground.brown.css?url';
import chessgroundCburnett from '../styles/chessground.cburnett.css?url';
import { buildMeta } from '~/utils/seo';

// Live game pages are ephemeral — keep them out of search indexes.
export function meta() {
  return buildMeta({ title: 'Collaborative Checkmate', noIndex: true });
}

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: chessgroundBase },
  { rel: 'stylesheet', href: chessgroundBrown },
  { rel: 'stylesheet', href: chessgroundCburnett },
];

export const loader = async ({ params }: { params: { gameId?: string; playerId?: string } }) => {
  return Response.json({ gameId: params.gameId ?? '', playerId: params.playerId ?? '' });
};

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function arrow(uci: string, brush: string): DrawShape {
  return { orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush };
}

export default function CollaborativeCheckmate() {
  const { gameId, playerId } = useLoaderData<typeof loader>();
  const isPrivate = (useLocation().state as { isPrivate?: boolean } | null)?.isPrivate === true;
  const { game, connected, notFound, errors, clockOffset, send } = useCollaborativeCheckmate(
    gameId,
    playerId,
    isPrivate,
  );
  // Bumped after each move you try, so the board puts the piece back and shows your choice as an arrow.
  const [tries, setTries] = useState(0);

  const fen = game?.fen ?? START_FEN;
  const yourSeat = game?.yourSeat ?? null;
  const playerTeam = yourSeat ? teamOf(yourSeat) : null;
  const lockedIn = yourSeat ? (game?.seats[yourSeat].lockedIn ?? false) : false;

  const players = useMemo(
    () =>
      Object.fromEntries(
        SEATS.map((s) => [s, { id: game?.seats[s].player ?? null, ready: game?.seats[s].ready ?? false }]),
      ) as Record<SeatKey, { id: string | null; ready: boolean }>,
    [game],
  );

  const shapes = useMemo(() => {
    const list: DrawShape[] = [];
    if (game?.lastMove) list.push(arrow(game.lastMove, 'yellow'));
    if (game?.yourSelection) list.push(arrow(game.yourSelection, 'blue'));
    return list;
  }, [game?.lastMove, game?.yourSelection]);

  const handleMove = useCallback(
    (orig: string, dest: string) => {
      const piece = new Chess(fen).get(orig as Parameters<Chess['get']>[0]);
      const promotes = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1');
      setTries((n) => n + 1);
      void send({ type: 'submit_move', move: `${orig}${dest}${promotes ? 'q' : ''}` });
    },
    [fen, send],
  );

  const chessboardEvents = useMemo(() => ({ move: handleMove }), [handleMove]);
  const chessboardDrawable = useMemo(
    () => ({ enabled: true, visible: true, defaultSnapToValidMove: true, eraseOnClick: true }),
    [],
  );

  const log: GameLogEntry[] = useMemo(
    () =>
      [
        ...(game?.log ?? []),
        ...errors.map((e) => ({ at: e.at - clockOffset, type: 'error' as const, message: e.message })),
      ].sort((a, b) => a.at - b.at),
    [game?.log, errors, clockOffset],
  );

  const timeRemaining = game?.deadline ? Math.max(0, (game.deadline + clockOffset - Date.now()) / 1000) : 0;

  return (
    <div className="relative z-10 flex min-h-screen flex-col bg-black bg-fixed">
      <Navbar />
      <main className="flex-grow">
        <section className="article">
          <article className="article-card">
            <header className="article-header">
              <h1 className="article-title">Collaborative Checkmate</h1>
            </header>
            <div className="prose">
              {notFound ? (
                <p className="font-neo text-black">
                  Game <strong>{gameId}</strong> has ended or doesn’t exist.{' '}
                  <Link to="/collaborative-checkmate">Start or join another</Link>.
                </p>
              ) : (
                <div className="mx-auto grid grid-cols-1 gap-6 pb-6 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <ChessBoard
                      fen={fen}
                      resetKey={`${fen}-${tries}`}
                      autoShapes={shapes}
                      orientation={playerTeam === 2 ? 'black' : 'white'}
                      gamePhase={game?.phase ?? 'setup'}
                      playerTeam={playerTeam}
                      lockedIn={lockedIn}
                      chessboardEvents={chessboardEvents}
                      chessboardDrawable={chessboardDrawable}
                    />

                    <GameControls
                      gamePhase={game?.phase ?? 'setup'}
                      timeRemaining={timeRemaining}
                      timeRemainingKey={String(game?.deadline ?? 'none')}
                      connected={connected}
                      selectedMove={Boolean(game?.yourSelection)}
                      lockedIn={lockedIn}
                      onLockInMove={() => void send({ type: 'lock_in' })}
                    />

                    <PlayerSeats
                      players={players}
                      playerId={playerId}
                      connected={connected}
                      onTakeSeat={(seat) => void send({ type: 'take_seat', seat })}
                      onReadyUp={() => void send({ type: 'ready' })}
                      getCurrentPlayerSeat={() => yourSeat}
                    />
                  </div>

                  <div className="md:col-span-1">
                    <GameLog gameLog={log} connected={connected} reconnecting={game !== null && !connected} />
                  </div>
                </div>
              )}
            </div>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  );
}
