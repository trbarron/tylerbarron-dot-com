import { useCallback, useEffect, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Key } from "chessground/types";
import { getEngine, getThinkTime, isEngineTimeoutError } from "~/utils/multipleChoiceChess/stockfishEngine";
import type { CandidateMove } from "~/utils/multipleChoiceChess/moveParser";
import type { GameState } from "~/utils/multipleChoiceChess/gameState.server";
import type { MoveHistoryEntry } from "~/utils/multipleChoiceChess/types";

export type Phase =
  | 'loading_engine'
  | 'waiting_opponent'
  | 'my_thinking'
  | 'my_choosing'
  | 'submitting'
  | 'opp_turn'
  | 'game_over';

const ACTIVE_POLL_INTERVAL = 1200;   // opponent's turn — fast feedback
const WAITING_POLL_INTERVAL = 4000;  // pre-game lobby wait — quieter
const MOVE_PAUSE = 800;
const NOW_TICK_INTERVAL = 2000;      // re-render cadence for elapsed-time displays

// Random legal moves used when the engine fails. Marked rank 0 so the server
// doesn't award points or increment rank counters — those would silently
// corrupt stats based on which random move was chosen.
function fallbackMovesFromFen(fen: string): CandidateMove[] {
  const chess = new Chess(fen);
  const legal = chess.moves({ verbose: true });
  if (legal.length === 0) return [];

  const shuffled = [...legal];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, 4).map((m) => ({
    uci: `${m.from}${m.to}${m.promotion ?? ''}`,
    san: m.san,
    rank: 0 as const,
  }));
}

interface UseMultipleChoiceChessGameOptions {
  gameId: string;
  playerId: string;
}

export function useMultipleChoiceChessGame({ gameId, playerId }: UseMultipleChoiceChessGameOptions) {
  const [phase, setPhase] = useState<Phase>('loading_engine');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [candidates, setCandidates] = useState<CandidateMove[]>([]);
  const [pickedUci, setPickedUci] = useState<string | null>(null);
  const [hoveredUci, setHoveredUci] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<[string, string] | undefined>(undefined);
  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);
  const [viewingMoveIndex, setViewingMoveIndex] = useState<number | null>(null);
  const [modalDismissed, setModalDismissed] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const myColorRef = useRef<'white' | 'black' | null>(null);

  const getMyColor = useCallback((gs: GameState): 'white' | 'black' | null => {
    if (gs.white_id === playerId) return 'white';
    if (gs.black_id === playerId) return 'black';
    return null;
  }, [playerId]);

  const isMyTurn = useCallback((gs: GameState): boolean => {
    const c = getMyColor(gs);
    return c !== null && gs.turn === c;
  }, [getMyColor]);

  // Engine boot
  const initEngine = useCallback(() => {
    setError(null);
    const engine = getEngine();
    engine.init()
      .then(() => setEngineReady(true))
      .catch((err) => setError(`Engine failed to load: ${err.message}`));
  }, []);

  const retryEngineInit = useCallback(() => {
    const engine = getEngine();
    engine.terminate();
    initEngine();
  }, [initEngine]);

  useEffect(() => {
    initEngine();
  }, [initEngine]);

  const fetchState = useCallback(async (): Promise<GameState | null> => {
    try {
      // playerId is passed so the server can refresh our last_seen — that's
      // how the opponent's client detects whether we're still around.
      const res = await fetch(
        `/api/multipleChoiceChess/state?gameId=${gameId}&playerId=${encodeURIComponent(playerId)}`,
      );
      if (!res.ok) return null;
      return await res.json() as GameState;
    } catch {
      return null;
    }
  }, [gameId, playerId]);

  const runAnalysis = useCallback(async (fen: string) => {
    setPhase('my_thinking');
    setCandidates([]);
    setPickedUci(null);

    try {
      const engine = getEngine();
      const moves = await engine.analyze(fen, getThinkTime());
      if (moves.length === 0) throw new Error('Engine returned no moves');
      setCandidates(moves);
      setPhase('my_choosing');
      return;
    } catch (err) {
      if (isEngineTimeoutError(err)) {
        try {
          const engine = getEngine();
          engine.terminate();
          await engine.init();
          const recovered = await engine.analyze(fen, getThinkTime());
          if (recovered.length > 0) {
            setCandidates(recovered);
            setPhase('my_choosing');
            setError('Engine was slow, but recovered. Please choose a move.');
            return;
          }
        } catch {
          // fall through to local fallback
        }

        const fallback = fallbackMovesFromFen(fen);
        if (fallback.length > 0) {
          setCandidates(fallback);
          setPhase('my_choosing');
          setError('Engine timed out. Showing random legal moves (unscored) so you can keep playing.');
          return;
        }
      }

      setError(`Analysis error: ${err instanceof Error ? err.message : String(err)}`);
    }

    const moves = fallbackMovesFromFen(fen);
    if (moves.length === 0) {
      setError('No legal moves available. The game may be over.');
      return;
    }
    setCandidates(moves);
    setPhase('my_choosing');
    setError('Engine unavailable. Showing random legal moves (unscored) so you can keep playing.');
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const submitMove = useCallback(async (gs: GameState, move: CandidateMove) => {
    setPickedUci(move.uci);
    setHoveredUci(null);
    setPhase('submitting');

    const from = move.uci.slice(0, 2);
    const to = move.uci.slice(2, 4);
    const promotion = move.uci.length === 5 ? move.uci[4] : undefined;

    let optimisticFen = gs.fen;
    try {
      const optimistic = new Chess(gs.fen);
      optimistic.move({ from, to, promotion });
      optimisticFen = optimistic.fen();
      setGameState({
        ...gs,
        fen: optimisticFen,
        turn: gs.turn === 'white' ? 'black' : 'white',
      });
      setLastMove([from, to]);
    } catch {
      // engine moves should be legal; fall through
    }

    setMoveHistory(prev => [...prev, {
      color: myColorRef.current ?? gs.turn,
      san: move.san,
      uci: move.uci,
      rank: move.rank,
      fenBefore: gs.fen,
      fenAfter: optimisticFen,
    }]);
    setViewingMoveIndex(null);

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
        setGameState(gs);
        setLastMove(undefined);
        setMoveHistory(prev => prev.slice(0, -1));
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

  const handleOpponentMove = useCallback((gs: GameState, prevFen: string) => {
    stopPolling();

    if (gs.last_move) {
      const from = gs.last_move.slice(0, 2);
      const to = gs.last_move.slice(2, 4);
      setLastMove([from, to]);

      const movedColor: 'white' | 'black' = gs.turn === 'white' ? 'black' : 'white';
      try {
        const chess = new Chess(prevFen);
        const promotion = gs.last_move.length === 5 ? gs.last_move[4] : undefined;
        const result = chess.move({ from, to, promotion });
        setMoveHistory(prev => [...prev, {
          color: movedColor,
          san: result.san,
          uci: gs.last_move,
          rank: gs.last_move_rank,
          fenBefore: prevFen,
          fenAfter: gs.fen,
        }]);
      } catch {
        setMoveHistory(prev => [...prev, {
          color: movedColor,
          san: gs.last_move,
          uci: gs.last_move,
          rank: gs.last_move_rank,
          fenBefore: prevFen,
          fenAfter: gs.fen,
        }]);
      }
    }

    setTimeout(() => {
      if (gs.status === 'complete') {
        setPhase('game_over');
      } else {
        runAnalysis(gs.fen);
      }
    }, MOVE_PAUSE);
  }, [runAnalysis, stopPolling]);

  const startPolling = useCallback((interval: number = ACTIVE_POLL_INTERVAL) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      const gs = await fetchState();
      if (!gs) return;

      // Transition from waiting → active when opponent joins
      if (gs.status === 'active' && (!gameState || gameState.status === 'waiting')) {
        setGameState(gs);
        setLastUpdated(gs.last_updated);
        myColorRef.current = getMyColor(gs);
        if (isMyTurn(gs)) {
          stopPolling();
          runAnalysis(gs.fen);
        }
        return;
      }

      if (gs.last_updated > lastUpdated && gs.status !== 'waiting') {
        const prevFen = gameState?.fen ?? gs.fen;
        setGameState(gs);
        setLastUpdated(gs.last_updated);
        if (gs.status === 'complete') {
          stopPolling();
          setPhase('game_over');
          return;
        }
        if (isMyTurn(gs)) {
          handleOpponentMove(gs, prevFen);
        }
      }
    }, interval);
  }, [fetchState, gameState, getMyColor, handleOpponentMove, isMyTurn, lastUpdated, runAnalysis, stopPolling]);

  // Boot once engine is ready
  useEffect(() => {
    if (!engineReady) return;
    let cancelled = false;

    (async () => {
      const gs = await fetchState();
      if (cancelled) return;
      if (!gs) {
        setError('Game not found. The link may be invalid or the game expired.');
        return;
      }

      setGameState(gs);
      setLastUpdated(gs.last_updated);
      myColorRef.current = getMyColor(gs);

      if (gs.status === 'complete') { setPhase('game_over'); return; }
      if (gs.status === 'waiting') { setPhase('waiting_opponent'); startPolling(WAITING_POLL_INTERVAL); return; }

      if (isMyTurn(gs)) {
        runAnalysis(gs.fen);
      } else {
        setPhase('opp_turn');
        startPolling(ACTIVE_POLL_INTERVAL);
      }
    })();

    return () => {
      cancelled = true;
      stopPolling();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineReady]);

  // Poll while waiting / opponent's turn
  useEffect(() => {
    if (phase === 'opp_turn') {
      startPolling(ACTIVE_POLL_INTERVAL);
    } else if (phase === 'waiting_opponent') {
      startPolling(WAITING_POLL_INTERVAL);
    } else {
      stopPolling();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Keyboard navigation through history
  useEffect(() => {
    if (moveHistory.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowDown') return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      setViewingMoveIndex(prev => {
        const lastIdx = moveHistory.length - 1;
        if (e.key === 'ArrowDown') return null;
        if (e.key === 'ArrowLeft') {
          if (prev === null) return lastIdx;
          return Math.max(0, prev - 1);
        }
        if (prev === null) return null;
        return prev >= lastIdx ? null : prev + 1;
      });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveHistory.length]);

  const pick = useCallback((move: CandidateMove) => {
    if (!gameState || phase !== 'my_choosing') return;
    submitMove(gameState, move);
  }, [gameState, phase, submitMove]);

  // Tick `now` while the game is in a state where elapsed-time matters
  // (waiting opponent or opponent's turn) so abandonment banners update.
  useEffect(() => {
    if (phase !== 'opp_turn' && phase !== 'waiting_opponent') return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), NOW_TICK_INTERVAL);
    return () => clearInterval(id);
  }, [phase]);

  const claimWin = useCallback(async () => {
    if (!gameState) return;
    try {
      const res = await fetch('/api/multipleChoiceChess/claimWin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId, player_id: playerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to claim win');
      }
      const updated = await fetchState();
      if (updated) {
        setGameState(updated);
        setPhase('game_over');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to claim win');
    }
  }, [gameState, gameId, playerId, fetchState]);

  const resign = useCallback(async () => {
    if (!gameState) return;
    try {
      const res = await fetch('/api/multipleChoiceChess/resign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: gameId, player_id: playerId }),
      });
      if (!res.ok) throw new Error('Failed to resign');
      const updated = await fetchState();
      if (updated) {
        setGameState(updated);
        setPhase('game_over');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resign');
    }
  }, [gameState, gameId, playerId, fetchState]);

  const color: 'white' | 'black' = gameState ? (getMyColor(gameState) ?? 'white') : 'white';

  // Opponent inactivity: null when not applicable (no opponent yet, game over,
  // or it's our turn). Otherwise ms since their last poll.
  const opponentInactiveMs = (() => {
    if (!gameState) return null;
    if (gameState.status !== 'active') return null;
    if (gameState.turn === color) return null; // our turn — they can be idle
    const oppLastSeen = color === 'white' ? gameState.black_last_seen : gameState.white_last_seen;
    if (!oppLastSeen) return null;
    return Math.max(0, now - oppLastSeen);
  })();

  const displayedFen = viewingMoveIndex !== null
    ? moveHistory[viewingMoveIndex]?.fenAfter ?? (gameState?.fen ?? 'start')
    : (gameState?.fen ?? 'start');

  const displayedLastMove: [string, string] | undefined = viewingMoveIndex !== null
    ? [
        moveHistory[viewingMoveIndex]?.uci.slice(0, 2) ?? '',
        moveHistory[viewingMoveIndex]?.uci.slice(2, 4) ?? '',
      ] as [string, string]
    : lastMove;

  const hoverShapes = hoveredUci && viewingMoveIndex === null
    ? [{ orig: hoveredUci.slice(0, 2) as Key, dest: hoveredUci.slice(2, 4) as Key, brush: 'blue' }]
    : [];

  return {
    phase,
    gameState,
    candidates,
    pickedUci,
    hoveredUci,
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
  };
}
