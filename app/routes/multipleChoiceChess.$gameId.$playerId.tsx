import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useLoaderData, useNavigate, type LinksFunction } from "react-router";
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import EngineStatus from "~/components/MultipleChoiceChess/EngineStatus";
import MoveChoices from "~/components/MultipleChoiceChess/MoveChoices";
import ScorePanel from "~/components/MultipleChoiceChess/ScorePanel";
import ResultFeedback from "~/components/MultipleChoiceChess/ResultFeedback";
import GameOverModal from "~/components/MultipleChoiceChess/GameOverModal";
import { getEngine, getThinkTime } from "~/utils/multipleChoiceChess/stockfishEngine";
import type { CandidateMove } from "~/utils/multipleChoiceChess/moveParser";
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
  | 'waiting_opponent'   // game not yet active (other player hasn't joined)
  | 'my_thinking'        // Stockfish analyzing on my device
  | 'my_choosing'        // player picking from 4 options
  | 'my_feedback'        // showing result of my pick before next turn
  | 'opp_turn'           // polling for opponent's move
  | 'opp_feedback'       // briefly showing what opponent played
  | 'game_over';

interface FeedbackState {
  san: string;
  rank: number;
  isMyMove: boolean;
}

const POLL_INTERVAL = 1200;
const FEEDBACK_DURATION = 2500;

export default function MultipleChoiceChessGame() {
  const { gameId, playerId } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading_engine');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [candidates, setCandidates] = useState<CandidateMove[]>([]);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>(undefined);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const myColor = useRef<'white' | 'black' | null>(null);

  // Derive my color from game state once we have it
  const getMyColor = useCallback((gs: GameState): 'white' | 'black' | null => {
    if (gs.white_id === playerId) return 'white';
    if (gs.black_id === playerId) return 'black';
    return null;
  }, [playerId]);

  const isMyTurn = useCallback((gs: GameState): boolean => {
    const color = getMyColor(gs);
    return color !== null && gs.turn === color;
  }, [getMyColor]);

  // Initialize engine on mount
  useEffect(() => {
    const engine = getEngine();
    engine.init()
      .then(() => setEngineReady(true))
      .catch((err) => setError(`Engine failed to load: ${err.message}`));
  }, []);

  // Fetch game state once
  const fetchState = useCallback(async (): Promise<GameState | null> => {
    try {
      const res = await fetch(`/api/multipleChoiceChess/state?gameId=${gameId}`);
      if (!res.ok) return null;
      return await res.json() as GameState;
    } catch {
      return null;
    }
  }, [gameId]);

  // Run Stockfish analysis and show choices
  const runAnalysis = useCallback(async (fen: string) => {
    setPhase('my_thinking');
    setCandidates([]);
    setSelectedRank(null);

    try {
      const engine = getEngine();
      const moves = await engine.analyze(fen, getThinkTime());
      if (moves.length === 0) {
        setError('Engine returned no moves. The game may be over.');
        return;
      }
      setCandidates(moves);
      setPhase('my_choosing');
    } catch (err) {
      setError(`Analysis error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Submit chosen move to server
  const submitMove = useCallback(async (gs: GameState, move: CandidateMove) => {
    setSelectedRank(move.rank);
    setPhase('my_feedback');

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
        throw new Error(data.error ?? 'Move rejected');
      }

      const from = move.uci.slice(0, 2) as `${string}${string}`;
      const to = move.uci.slice(2, 4) as `${string}${string}`;
      setLastMove([from, to]);

      setFeedback({ san: move.san, rank: move.rank, isMyMove: true });

      setTimeout(async () => {
        setFeedback(null);
        // Refresh state after submitting
        const updated = await fetchState();
        if (updated) {
          setGameState(updated);
          setLastUpdated(updated.last_updated);
          if (updated.status === 'complete') {
            setPhase('game_over');
          } else {
            setPhase('opp_turn');
          }
        }
      }, FEEDBACK_DURATION);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit move');
      setPhase('my_choosing');
    }
  }, [gameId, playerId, candidates, fetchState]);

  // Polling logic — defined before handleOpponentMove so it can be referenced in deps
  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Handle opponent's new move arriving via poll
  const handleOpponentMove = useCallback((gs: GameState) => {
    stopPolling();

    if (gs.last_move) {
      const from = gs.last_move.slice(0, 2) as `${string}${string}`;
      const to = gs.last_move.slice(2, 4) as `${string}${string}`;
      setLastMove([from, to]);
    }

    setFeedback({
      san: gs.last_move || '?',
      rank: gs.last_move_rank,
      isMyMove: false,
    });
    setPhase('opp_feedback');

    setTimeout(() => {
      setFeedback(null);
      if (gs.status === 'complete') {
        setPhase('game_over');
      } else {
        runAnalysis(gs.fen);
      }
    }, FEEDBACK_DURATION);
  }, [runAnalysis, stopPolling]);

  const startPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollRef.current = setInterval(async () => {
      const gs = await fetchState();
      if (!gs) return;

      // Game became active (opponent joined)
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

      // Opponent made a move
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

  // Boot: fetch initial state, then branch based on what we find
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

      if (gs.status === 'complete') {
        setPhase('game_over');
        return;
      }

      if (gs.status === 'waiting') {
        setPhase('waiting_opponent');
        startPolling();
        return;
      }

      // Game is active
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

  // Start polling when entering opp_turn phase
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
    await fetch('/api/multipleChoiceChess/resign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: gameId, player_id: playerId }),
    });
    const updated = await fetchState();
    if (updated) {
      setGameState(updated);
      setPhase('game_over');
    }
  };

  const color = gameState ? (getMyColor(gameState) ?? 'white') : 'white';
  const orientation = color;

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/multipleChoiceChess/${gameId}`
    : '';

  const copyLink = () => navigator.clipboard?.writeText(shareUrl);

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

          {/* Waiting for opponent */}
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
                  Copy
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-400">Game code: {gameId}</p>
            </div>
          )}

          <div className="grid gap-6 pb-6 md:grid-cols-5">
            {/* Board */}
            <div className="md:col-span-3">
              <Suspense fallback={
                <div className="aspect-square w-full bg-gray-100 flex items-center justify-center font-neo text-black">
                  Loading board...
                </div>
              }>
                <Chessboard
                  initialFen={gameState?.fen ?? 'start'}
                  orientation={orientation}
                  viewOnly={true}
                  lastMove={lastMove}
                  highlightMoves={false}
                  movable={false}
                />
              </Suspense>

              {/* Resign button */}
              {gameState?.status === 'active' && phase !== 'game_over' && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleResign}
                    className="border-2 border-black px-3 py-1 font-neo text-sm font-bold uppercase text-gray-600 hover:bg-red-100 hover:text-red-700 hover:border-red-500"
                  >
                    Resign
                  </button>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4 md:col-span-2">
              {/* Score */}
              {gameState && gameState.status !== 'waiting' && (
                <ScorePanel
                  myColor={color}
                  whiteScore={gameState.white_score}
                  blackScore={gameState.black_score}
                  whiteMoves={gameState.white_moves}
                  blackMoves={gameState.black_moves}
                  turn={gameState.turn}
                />
              )}

              {/* Engine loading */}
              {phase === 'loading_engine' && <EngineStatus phase="loading" />}

              {/* Engine thinking */}
              {phase === 'my_thinking' && <EngineStatus phase="thinking" />}

              {/* Opponent's turn */}
              {(phase === 'opp_turn' || phase === 'waiting_opponent') && gameState?.status === 'active' && (
                <EngineStatus phase="opponent" />
              )}

              {/* Move choices */}
              {(phase === 'my_choosing' || phase === 'my_feedback') && candidates.length > 0 && (
                <div>
                  <p className="mb-2 font-neo text-sm font-bold uppercase text-gray-500">
                    Your move ({color}):
                  </p>
                  <MoveChoices
                    moves={candidates}
                    selectedRank={selectedRank}
                    onPick={handlePick}
                    disabled={phase === 'my_feedback'}
                  />
                </div>
              )}

              {/* Feedback banners */}
              {feedback && (
                <ResultFeedback
                  san={feedback.san}
                  rank={feedback.rank}
                  isMyMove={feedback.isMyMove}
                />
              )}
            </div>
          </div>
        </Article>
      </main>
      <Footer />

      {/* Game over modal */}
      {phase === 'game_over' && gameState?.status === 'complete' && (
        <GameOverModal
          result={gameState.result as 'white' | 'black' | 'draw'}
          reason={gameState.result_reason}
          myColor={color}
          whiteScore={gameState.white_score}
          blackScore={gameState.black_score}
          whiteMoves={gameState.white_moves}
          blackMoves={gameState.black_moves}
          onPlayAgain={() => navigate('/multipleChoiceChess')}
        />
      )}
    </div>
  );
}
