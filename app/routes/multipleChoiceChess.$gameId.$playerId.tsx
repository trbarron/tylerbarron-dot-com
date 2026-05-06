import { useRef, useState, Suspense, lazy } from "react";
import { useLoaderData, useNavigate, type LinksFunction } from "react-router";
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import EngineStatus from "~/components/MultipleChoiceChess/EngineStatus";
import MoveChoices from "~/components/MultipleChoiceChess/MoveChoices";
import MoveHistory from "~/components/MultipleChoiceChess/MoveHistory";
import GameOverModal from "~/components/MultipleChoiceChess/GameOverModal";
import { useMultipleChoiceChessGame } from "~/hooks/useMultipleChoiceChessGame";

import chessgroundBase from '../styles/chessground.base.css?url';
import chessgroundBrown from '../styles/chessground.brown.css?url';
import chessgroundCburnett from '../styles/chessground.cburnett.css?url';

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
  } = useMultipleChoiceChessGame({ gameId: gameId ?? '', playerId: playerId ?? '' });

  const [linkCopied, setLinkCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const shareInputRef = useRef<HTMLInputElement | null>(null);

  const INACTIVITY_BANNER_MS = 45_000;
  const CLAIM_THRESHOLD_MS = 90_000;
  const showInactivityBanner = opponentInactiveMs !== null && opponentInactiveMs >= INACTIVITY_BANNER_MS;
  const canClaimWin = opponentInactiveMs !== null && opponentInactiveMs >= CLAIM_THRESHOLD_MS;

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/multiple-choice-chess?join=${encodeURIComponent(gameId ?? '')}`
    : '';

  const copyLink = async () => {
    setCopyFailed(false);
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context, permissions, etc.) — select the
      // input so the user can copy with ⌘/Ctrl+C, and show a hint.
      shareInputRef.current?.select();
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 4000);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article title="Multiple Choice Chess" subtitle="">

          {error && (
            <div className="mb-4 flex items-center justify-between gap-3 border-4 border-red-500 bg-red-100 p-4 font-neo text-red-800">
              <span>{error}</span>
              {!engineReady && error.startsWith('Engine failed to load') && (
                <button
                  onClick={retryEngineInit}
                  className="shrink-0 border-2 border-red-700 bg-white px-3 py-1 text-sm font-bold uppercase text-red-800 hover:bg-red-700 hover:text-white"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {showInactivityBanner && opponentInactiveMs !== null && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-4 border-amber-500 bg-amber-50 p-4 font-neo text-amber-900">
              <div>
                <div className="font-bold uppercase">Opponent inactive</div>
                <div className="text-sm">
                  No response for {Math.floor(opponentInactiveMs / 1000)}s.
                  {!canClaimWin && ` You can claim a win after ${Math.ceil((CLAIM_THRESHOLD_MS - opponentInactiveMs) / 1000)}s.`}
                </div>
              </div>
              {canClaimWin && (
                <button
                  onClick={claimWin}
                  className="border-2 border-amber-700 bg-white px-3 py-1 text-sm font-bold uppercase text-amber-900 hover:bg-amber-700 hover:text-white"
                >
                  Claim win
                </button>
              )}
            </div>
          )}

          {phase === 'waiting_opponent' && gameState && (
            <div className="mb-4 border-4 border-black bg-white p-6 font-neo">
              <p className="font-bold uppercase">Waiting for opponent to join...</p>
              <p className="mt-2 text-sm text-gray-600">Share this link:</p>
              <div className="mt-2 flex gap-2">
                <input
                  ref={shareInputRef}
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 border-2 border-black bg-gray-50 px-3 py-2 text-sm font-mono"
                />
                <button
                  onClick={copyLink}
                  className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase hover:bg-black hover:text-white active:bg-black active:text-white"
                >
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {copyFailed && (
                <p className="mt-2 text-xs text-red-700">
                  Couldn't access the clipboard. Press ⌘C / Ctrl+C to copy the selected link.
                </p>
              )}
              <p className="mt-2 text-xs text-gray-400">Game code: {gameId}</p>
            </div>
          )}

          <div className="grid gap-6 pb-6 md:grid-cols-5">
            <div className="md:col-span-3">
              <Suspense fallback={
                <div className="aspect-square w-full bg-gray-100 flex items-center justify-center font-neo text-black">
                  Loading board...
                </div>
              }>
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
                <div className="mt-3 flex justify-between items-center gap-2 flex-wrap">
                  <div className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase text-gray-600">
                    Move {viewingMoveIndex + 1} of {moveHistory.length}
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`https://lichess.org/analysis/standard/${encodeURIComponent((moveHistory[viewingMoveIndex]?.fenAfter ?? '').replace(/ /g, '_'))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase hover:bg-black hover:text-white active:bg-black active:text-white"
                    >
                      Lichess ↗
                    </a>
                    <button
                      onClick={() => setViewingMoveIndex(Math.max(0, viewingMoveIndex - 1))}
                      disabled={viewingMoveIndex === 0}
                      className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase disabled:opacity-40 hover:bg-black hover:text-white active:bg-black active:text-white"
                    >
                      ←
                    </button>
                    <button
                      onClick={() => {
                        if (viewingMoveIndex < moveHistory.length - 1) {
                          setViewingMoveIndex(viewingMoveIndex + 1);
                        } else {
                          setViewingMoveIndex(null);
                        }
                      }}
                      className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase hover:bg-black hover:text-white active:bg-black active:text-white"
                    >
                      {viewingMoveIndex < moveHistory.length - 1 ? '→' : '↓ Live'}
                    </button>
                  </div>
                </div>
              )}

              {gameState?.status === 'active' && phase !== 'game_over' && viewingMoveIndex === null && (
                <div className="mt-3 flex justify-between items-center">
                  <div
                    className={[
                      'border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase',
                      gameState.turn === color
                        ? 'bg-black text-white'
                        : 'bg-white text-gray-500',
                    ].join(' ')}
                  >
                    {gameState.turn === color ? 'Your turn' : "Opponent's turn"}
                  </div>
                  <button
                    onClick={() => setConfirmingResign(true)}
                    className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase text-gray-600 hover:bg-red-100 hover:text-red-700 hover:border-red-500 active:bg-red-100 active:text-red-700"
                  >
                    Resign
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4 md:col-span-2">
              {phase === 'loading_engine' && <EngineStatus phase="loading" />}
              {phase === 'my_thinking' && <EngineStatus phase="thinking" />}
              {(phase === 'opp_turn' || phase === 'waiting_opponent') && gameState?.status === 'active' && (
                <EngineStatus phase="opponent" since={gameState.last_updated} />
              )}

              {(phase === 'my_choosing' || phase === 'submitting') && candidates.length > 0 && viewingMoveIndex === null && (
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
        </Article>
      </main>
      <Footer />

      {confirmingResign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm border-4 border-black bg-white font-neo">
            <div className="border-b-4 border-black p-5 text-center">
              <h2 className="text-xl font-extrabold uppercase">Resign this game?</h2>
            </div>
            <div className="grid grid-cols-2 divide-x-4 divide-black">
              <button
                onClick={() => setConfirmingResign(false)}
                className="px-4 py-3 font-bold uppercase text-sm hover:bg-black hover:text-white active:bg-black active:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => { setConfirmingResign(false); resign(); }}
                className="px-4 py-3 font-extrabold uppercase tracking-wide text-red-700 hover:bg-red-600 hover:text-white active:bg-red-600 active:text-white"
              >
                Resign
              </button>
            </div>
          </div>
        </div>
      )}

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
          onReview={() => {
            setModalDismissed(true);
            setViewingMoveIndex(moveHistory.length > 0 ? moveHistory.length - 1 : null);
          }}
        />
      )}
    </div>
  );
}
