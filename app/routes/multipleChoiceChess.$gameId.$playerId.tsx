import { useRef, useState, Suspense, lazy } from 'react';
import { useLoaderData, useNavigate, type LinksFunction } from 'react-router';
import { Navbar } from '~/components/Navbar';
import Footer from '~/components/Footer';
import Button, { buttonClass } from '~/components/Button';
import EngineStatus from '~/components/MultipleChoiceChess/EngineStatus';
import MoveChoices from '~/components/MultipleChoiceChess/MoveChoices';
import MoveHistory from '~/components/MultipleChoiceChess/MoveHistory';
import GameOverModal from '~/components/MultipleChoiceChess/GameOverModal';
import { useMultipleChoiceChessGame } from '~/hooks/useMultipleChoiceChessGame';
import { buildMeta } from '~/utils/seo';

// Live game pages are ephemeral — keep them out of search indexes.
export function meta() {
  return buildMeta({ title: 'Multiple Choice Chess', noIndex: true });
}

import chessgroundBase from '../styles/chessground.base.css?url';
import chessgroundBrown from '../styles/chessground.brown.css?url';
import chessgroundCburnett from '../styles/chessground.cburnett.css?url';
import Dialog from '~/components/Dialog';
import { useCopy } from '~/hooks/useCopy';
import Notice from '~/components/Notice';

const Chessboard = lazy(() => import('~/components/Chessboard'));

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: chessgroundBase },
  { rel: 'stylesheet', href: chessgroundBrown },
  { rel: 'stylesheet', href: chessgroundCburnett },
];

export const loader = async ({ params }: { params: { gameId?: string; playerId?: string } }) => {
  return Response.json({ gameId: params.gameId, playerId: params.playerId });
};

export default function MultipleChoiceChessGame() {
  const { gameId, playerId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const {
    phase,
    gameState,
    candidates,
    pickedUci,
    error,
    moveHistory,
    viewingMoveIndex,
    modalDismissed,
    color,
    displayedFen,
    displayedLastMove,
    hoverShapes,
    setHoveredUci,
    setViewingMoveIndex,
    setModalDismissed,
    pick,
    resign,
    retryEngineInit,
    engineReady,
    opponentInactiveMs,
    claimWin,
  } = useMultipleChoiceChessGame({
    gameId: gameId ?? '',
    playerId: playerId ?? '',
  });

  const { state: copyState, copy } = useCopy();
  const [confirmingResign, setConfirmingResign] = useState(false);
  const shareInputRef = useRef<HTMLInputElement | null>(null);

  const INACTIVITY_BANNER_MS = 45_000;
  const CLAIM_THRESHOLD_MS = 90_000;
  const showInactivityBanner = opponentInactiveMs !== null && opponentInactiveMs >= INACTIVITY_BANNER_MS;
  const canClaimWin = opponentInactiveMs !== null && opponentInactiveMs >= CLAIM_THRESHOLD_MS;

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/multiple-choice-chess?join=${encodeURIComponent(gameId ?? '')}`
      : '';

  const copyLink = async () => {
    // Clipboard blocked (insecure context, permissions, etc.): select the
    // input so the user can copy with ⌘/Ctrl+C; a hint shows below it.
    if (!(await copy(shareUrl))) shareInputRef.current?.select();
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow">
        <section className="article">
          <article className="article-card">
            <header className="article-header">
              <h1 className="article-title">Multiple Choice Chess</h1>
            </header>
            <div className="prose">
              {error && (
                <Notice
                  className="mb-4"
                  action={
                    !engineReady &&
                    error.startsWith('Engine failed to load') && (
                      <Button size="sm" onClick={retryEngineInit}>
                        Retry
                      </Button>
                    )
                  }
                >
                  {error}
                </Notice>
              )}

              {showInactivityBanner && opponentInactiveMs !== null && (
                <Notice
                  tone="info"
                  title="Opponent inactive"
                  className="mb-4"
                  action={
                    canClaimWin && (
                      <Button variant="danger" size="sm" onClick={claimWin}>
                        Claim win
                      </Button>
                    )
                  }
                >
                  No response for {Math.floor(opponentInactiveMs / 1000)}s.
                  {!canClaimWin &&
                    ` You can claim a win after ${Math.ceil((CLAIM_THRESHOLD_MS - opponentInactiveMs) / 1000)}s.`}
                </Notice>
              )}

              {phase === 'waiting_opponent' && gameState && (
                <div className="font-neo mb-4 border-4 border-black bg-white p-6">
                  <p className="font-bold uppercase">Waiting for opponent to join...</p>
                  <p className="mt-2 text-sm text-gray-600">Share this link:</p>
                  <div className="mt-2 flex gap-2">
                    <input
                      ref={shareInputRef}
                      readOnly
                      value={shareUrl}
                      onFocus={(e) => e.currentTarget.select()}
                      className="flex-1 border-2 border-black bg-gray-50 px-3 py-2 font-mono text-sm"
                    />
                    <Button size="sm" onClick={copyLink}>
                      {copyState === 'copied' ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  {copyState === 'failed' && (
                    <Notice tone="info" className="mt-2">
                      Couldn't access the clipboard. Press ⌘C / Ctrl+C to copy the selected link.
                    </Notice>
                  )}
                  <p className="mt-2 text-xs text-gray-400">Game code: {gameId}</p>
                </div>
              )}

              <div className="grid gap-6 pb-6 md:grid-cols-5">
                <div className="md:col-span-3">
                  <Suspense
                    fallback={
                      <div className="font-neo flex aspect-square w-full items-center justify-center bg-gray-100 text-black">
                        Loading board...
                      </div>
                    }
                  >
                    <Chessboard
                      initialFen={displayedFen}
                      orientation={color}
                      viewOnly={true}
                      lastMove={displayedLastMove}
                      highlightMoves={true}
                      movable={false}
                      autoShapes={hoverShapes}
                    />
                  </Suspense>

                  {viewingMoveIndex !== null && (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="font-neo border-2 border-black px-3 py-1 text-sm font-bold text-gray-600 uppercase">
                        Move {viewingMoveIndex + 1} of {moveHistory.length}
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`https://lichess.org/analysis/standard/${encodeURIComponent((moveHistory[viewingMoveIndex]?.fenAfter ?? '').replace(/ /g, '_'))}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClass({ size: 'sm' })}
                        >
                          Lichess ↗
                        </a>
                        <Button
                          size="sm"
                          onClick={() => setViewingMoveIndex(Math.max(0, viewingMoveIndex - 1))}
                          disabled={viewingMoveIndex === 0}
                        >
                          ←
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            if (viewingMoveIndex < moveHistory.length - 1) {
                              setViewingMoveIndex(viewingMoveIndex + 1);
                            } else {
                              setViewingMoveIndex(null);
                            }
                          }}
                        >
                          {viewingMoveIndex < moveHistory.length - 1 ? '→' : '↓ Live'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {gameState?.status === 'active' && phase !== 'game_over' && viewingMoveIndex === null && (
                    <div className="mt-3 flex items-center justify-between">
                      <div
                        className={[
                          'font-neo border-2 border-black px-3 py-1 text-sm font-bold uppercase',
                          gameState.turn === color ? 'bg-black text-white' : 'bg-white text-gray-500',
                        ].join(' ')}
                      >
                        {gameState.turn === color ? 'Your turn' : "Opponent's turn"}
                      </div>
                      <Button variant="danger" size="sm" onClick={() => setConfirmingResign(true)}>
                        Resign
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-4 md:col-span-2">
                  {phase === 'loading_engine' && <EngineStatus phase="loading" />}
                  {phase === 'my_thinking' && <EngineStatus phase="thinking" />}
                  {(phase === 'opp_turn' || phase === 'waiting_opponent') && gameState?.status === 'active' && (
                    <EngineStatus phase="opponent" since={gameState.last_updated} />
                  )}

                  {(phase === 'my_choosing' || phase === 'submitting') &&
                    candidates.length > 0 &&
                    viewingMoveIndex === null && (
                      <div>
                        <MoveChoices
                          moves={candidates}
                          pickedUci={pickedUci}
                          onPick={pick}
                          onHover={setHoveredUci}
                          disabled={phase === 'submitting'}
                        />
                      </div>
                    )}

                  <MoveHistory
                    history={moveHistory}
                    viewingIndex={viewingMoveIndex}
                    onSelectMove={setViewingMoveIndex}
                    isGameActive={gameState?.status === 'active'}
                  />
                </div>
              </div>
            </div>
          </article>
        </section>
      </main>
      <Footer />

      <Dialog open={confirmingResign} onClose={() => setConfirmingResign(false)} title="Resign this game?" size="sm">
        <div className="grid grid-cols-2 gap-3 p-4">
          <Button className="w-full" onClick={() => setConfirmingResign(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              setConfirmingResign(false);
              resign();
            }}
          >
            Resign
          </Button>
        </div>
      </Dialog>

      {phase === 'game_over' && gameState?.status === 'complete' && !modalDismissed && (
        <GameOverModal
          result={gameState.result as 'white' | 'black' | 'draw'}
          reason={gameState.result_reason}
          myColor={color}
          whiteRank1={gameState.white_rank_1}
          whiteRank2={gameState.white_rank_2}
          whiteRank4={gameState.white_rank_4}
          whiteRank6={gameState.white_rank_6}
          blackRank1={gameState.black_rank_1}
          blackRank2={gameState.black_rank_2}
          blackRank4={gameState.black_rank_4}
          blackRank6={gameState.black_rank_6}
          moveHistory={moveHistory}
          onPlayAgain={() => navigate('/multiple-choice-chess')}
          onClose={() => setModalDismissed(true)}
          onReview={() => {
            setModalDismissed(true);
            setViewingMoveIndex(moveHistory.length > 0 ? moveHistory.length - 1 : null);
          }}
        />
      )}
    </div>
  );
}
