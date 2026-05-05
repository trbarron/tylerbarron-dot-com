import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useLoaderData, useNavigate, type LinksFunction } from "react-router";
import { Chess } from "chess.js";
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import EngineStatus from "~/components/MultipleChoiceChess/EngineStatus";
import MoveChoices from "~/components/MultipleChoiceChess/MoveChoices";
import GameOverModal from "~/components/MultipleChoiceChess/GameOverModal";
import { getEngine, getThinkTime } from "~/utils/multipleChoiceChess/stockfishEngine";
import type { CandidateMove } from "~/utils/multipleChoiceChess/moveParser";
import type { Key } from 'chessground/types';
import type { GameState } from "~/utils/multipleChoiceChess/gameState.server";

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

type Phase =
  | 'loading_engine'
  | 'waiting_opponent'
  | 'my_thinking'
  | 'my_choosing'
  | 'submitting'    // move sent, waiting for server + brief animation pause
  | 'opp_turn'
  | 'game_over';

const POLL_INTERVAL = 1200;
const MOVE_PAUSE = 800; // brief pause after a move plays so the animation is visible
const RANKS = [1, 2, 4, 6] as const;

function isTimeoutError(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes('timed out');
}

function fallbackMovesFromFen(fen: string): CandidateMove[] {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return [];

  const shuffled = [...legal];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, 4).map((m, idx) => {
    const promotion = m.promotion ?? '';
    return {
      uci: `${m.from}${m.to}${promotion}`,
      san: m.san,
      rank: RANKS[idx],
    };
  });
}

export default function MultipleChoiceChessGame() {
  const { gameId, playerId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading_engine');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [candidates, setCandidates] = useState<CandidateMove[]>([]);
  const [pickedUci, setPickedUci] = useState<string | null>(null);
  const [hoveredUci, setHoveredUci] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>(undefined);
  const [linkCopied, setLinkCopied] = useState(false);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const myColor = useRef<'white' | 'black' | null>(null);

  const getMyColor = useCallback((gs: GameState): 'white' | 'black' | null => {
    if (gs.white_id === playerId) return 'white';
    if (gs.black_id === playerId) return 'black';
    return null;
  }, [playerId]);

  const isMyTurn = useCallback((gs: GameState): boolean => {
    const color = getMyColor(gs);
    return color !== null && gs.turn === color;
  }, [getMyColor]);

  useEffect(() => {
    const engine = getEngine();
    engine.init()
      .then(() => {
        // Temporary debug signal to verify worker startup in browser console.
        console.info('[MultipleChoiceChess] Stockfish engine loaded successfully');
        setEngineReady(true);
      })
      .catch((err) => setError(`Engine failed to load: ${err.message}`));
  }, []);

  const fetchState = useCallback(async (): Promise<GameState | null> => {
    try {
      const res = await fetch(`/api/multipleChoiceChess/state?gameId=${gameId}`);
      if (!res.ok) return null;
      return await res.json() as GameState;
    } catch {
      return null;
    }
  }, [gameId]);

  const runAnalysis = useCallback(async (fen: string) => {
    setPhase('my_thinking');
    setCandidates([]);
    setPickedUci(null);

    try {
      const engine = getEngine();
      let moves = await engine.analyze(fen, getThinkTime());

      if (moves.length === 0) {
        throw new Error('Engine returned no moves');
      }

      setCandidates(moves);
      setPhase('my_choosing');
      return;
    } catch (err) {
      if (isTimeoutError(err)) {
        try {
          // Try to recover from transient worker stalls by restarting once.
          const engine = getEngine();
          engine.terminate();
          await engine.init();
          const recoveredMoves = await engine.analyze(fen, getThinkTime());
          if (recoveredMoves.length > 0) {
            setCandidates(recoveredMoves);
            setPhase('my_choosing');
            setError('Engine was slow, but recovered. Please choose a move.');
            return;
          }
        } catch {
          // Fall through to local fallback below.
        }

        const fallbackMoves = fallbackMovesFromFen(fen);
        if (fallbackMoves.length > 0) {
          setCandidates(fallbackMoves);
          setPhase('my_choosing');
          setError('Engine timed out. Showing random legal moves so you can keep playing.');
          return;
        }
      }

      setError(`Analysis error: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const moves = fallbackMovesFromFen(fen);
      if (moves.length === 0) {
        setError('No legal moves available. The game may be over.');
        return;
      }
      setCandidates(moves);
      setPhase('my_choosing');
      setError('Engine unavailable. Showing random legal moves so you can keep playing.');
    } catch {
      setError('Analysis error and fallback move generation failed.');
    }
  }, []);

  const submitMove = useCallback(async (gs: GameState, move: CandidateMove) => {
    setPickedUci(move.uci);
    setHoveredUci(null);
    setPhase('submitting');

    const from = move.uci.slice(0, 2) as `${string}${string}`;
    const to = move.uci.slice(2, 4) as `${string}${string}`;
    const promotion = move.uci.length === 5 ? move.uci[4] : undefined;

    // Optimistically apply the move locally so the board animates immediately
    let optimisticFen = gs.fen;
    try {
      const optimisticChess = new Chess(gs.fen);
      optimisticChess.move({ from, to, promotion });
      optimisticFen = optimisticChess.fen();
      setGameState({
        ...gs,
        fen: optimisticFen,
        turn: gs.turn === 'white' ? 'black' : 'white',
      });
      setLastMove([from, to]);
    } catch {
      // engine-generated moves should always be legal; fall through to server
    }

    try {
      const res = await fetch('/api/multipleChoiceChess/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          player_id: playerId,
          move: move.uci,
          rank: move.rank,
          choices: candidates.map((c) => c.uci),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        // Roll back optimistic update
        setGameState(gs);
        setLastMove(undefined);
        throw new Error(data.error ?? 'Move rejected');
      }

      const updated = await fetchState();
      if (updated) {
        setGameState(updated);
        setLastUpdated(updated.last_updated);
        setPhase(updated.status === 'complete' ? 'game_over' : 'opp_turn');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit move');
      setPickedUci(null);
      setPhase('my_choosing');
    }
  }, [gameId, playerId, candidates, fetchState]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const handleOpponentMove = useCallback((gs: GameState) => {
    stopPolling();

    if (gs.last_move) {
      const from = gs.last_move.slice(0, 2) as `${string}${string}`;
      const to = gs.last_move.slice(2, 4) as `${string}${string}`;
      setLastMove([from, to]);
    }

    setTimeout(() => {
      if (gs.status === 'complete') {
        setPhase('game_over');
      } else {
        runAnalysis(gs.fen);
      }
    }, MOVE_PAUSE);
  }, [runAnalysis, stopPolling]);

  const startPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollRef.current = setInterval(async () => {
      const gs = await fetchState();
      if (!gs) return;

      if (gs.status === 'active' && (!gameState || gameState.status === 'waiting')) {
        setGameState(gs);
        setLastUpdated(gs.last_updated);
        myColor.current = getMyColor(gs);
        if (isMyTurn(gs)) {
          stopPolling();
          runAnalysis(gs.fen);
        }
        return;
      }

      if (gs.last_updated > lastUpdated && gs.status !== 'waiting') {
        setGameState(gs);
        setLastUpdated(gs.last_updated);
        if (gs.status === 'complete') {
          stopPolling();
          setPhase('game_over');
          return;
        }
        if (isMyTurn(gs)) {
          handleOpponentMove(gs);
        }
      }
    }, POLL_INTERVAL);
  }, [fetchState, gameState, getMyColor, handleOpponentMove, isMyTurn, lastUpdated, runAnalysis, stopPolling]);

  useEffect(() => {
    if (!engineReady) return;

    const boot = async () => {
      const gs = await fetchState();
      if (!gs) {
        setError('Game not found. The link may be invalid or the game expired.');
        return;
      }

      setGameState(gs);
      setLastUpdated(gs.last_updated);
      myColor.current = getMyColor(gs);

      if (gs.status === 'complete') { setPhase('game_over'); return; }
      if (gs.status === 'waiting') { setPhase('waiting_opponent'); startPolling(); return; }

      if (isMyTurn(gs)) {
        runAnalysis(gs.fen);
      } else {
        setPhase('opp_turn');
        startPolling();
      }
    };

    boot();
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady]);

  useEffect(() => {
    if (phase === 'opp_turn' || phase === 'waiting_opponent') {
      startPolling();
    } else {
      stopPolling();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handlePick = (move: CandidateMove) => {
    if (!gameState || phase !== 'my_choosing') return;
    submitMove(gameState, move);
  };

  const handleResign = async () => {
    if (!gameState) return;
    if (!window.confirm('Resign this game?')) return;
    try {
      const res = await fetch('/api/multipleChoiceChess/resign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId, player_id: playerId }),
      });
      if (!res.ok) throw new Error('Failed to resign');
      const updated = await fetchState();
      if (updated) { setGameState(updated); setPhase('game_over'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resign');
    }
  };

  const color = gameState ? (getMyColor(gameState) ?? 'white') : 'white';

  const hoverShapes = hoveredUci
    ? [{ orig: hoveredUci.slice(0, 2) as Key, dest: hoveredUci.slice(2, 4) as Key, brush: 'blue' }]
    : [];

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/multiple-choice-chess?join=${encodeURIComponent(gameId ?? '')}`
    : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard not available; user can still copy the input field manually
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-grow">
        <Article title="Multiple Choice Chess" subtitle="">

          {error && (
            <div className="mb-4 border-4 border-red-500 bg-red-100 p-4 font-neo text-red-800">
              {error}
            </div>
          )}

          {phase === 'waiting_opponent' && gameState && (
            <div className="mb-4 border-4 border-black bg-white p-6 font-neo">
              <p className="font-bold uppercase">Waiting for opponent to join...</p>
              <p className="mt-2 text-sm text-gray-600">Share this link:</p>
              <div className="mt-2 flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  className="flex-1 border-2 border-black bg-gray-50 px-3 py-2 text-sm font-mono"
                />
                <button
                  onClick={copyLink}
                  className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase hover:bg-black hover:text-white"
                >
                  {linkCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
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
                  initialFen={gameState?.fen ?? 'start'}
                  orientation={color}
                  viewOnly={true}
                  lastMove={lastMove}
                  highlightMoves={true}
                  movable={false}
                  autoShapes={hoverShapes}
                />
              </Suspense>

              {gameState?.status === 'active' && phase !== 'game_over' && (
                <div className="mt-3 flex justify-between items-center">
                  <div className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase text-gray-600">
                    {gameState.turn === color ? 'Your turn' : "Opponent's turn"}
                  </div>
                  <button
                    onClick={handleResign}
                    className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase text-gray-600 hover:bg-red-100 hover:text-red-700 hover:border-red-500"
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
                <EngineStatus phase="opponent" />
              )}

              {(phase === 'my_choosing' || phase === 'submitting') && candidates.length > 0 && (
                <div>
                  <MoveChoices
                    moves={candidates}
                    pickedUci={pickedUci}
                    onPick={handlePick}
                    onHover={setHoveredUci}
                    disabled={phase === 'submitting'}
                  />
                </div>
              )}
            </div>
          </div>
        </Article>
      </main>
      <Footer />

      {phase === 'game_over' && gameState?.status === 'complete' && (
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
          onPlayAgain={() => navigate('/multiple-choice-chess')}
        />
      )}
    </div>
  );
}
