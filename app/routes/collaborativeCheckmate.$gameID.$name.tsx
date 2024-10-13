import React, { useEffect, useState, useCallback, useRef } from "react";
import {useNavigate , useLoaderData } from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";
import { ClientOnly } from "remix-utils/client-only";
import { Chess, Square } from "chess.js";
import { createClient } from '@supabase/supabase-js';
// import 'chessground/assets/chessground.base.css';
// import 'chessground/assets/chessground.brown.css';
// import 'chessground/assets/chessground.cburnett.css';

import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import { Subarticle } from "~/components/Subarticle";
import Article from "~/components/Article";
import { Modal } from '~/components/Modal';

const ChessgroundWrapper = React.lazy(() => import('~/components/ChessgroundWrapper'));
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false
  }
});

const TURN_TIMER = 10;

type LoaderData = {
  gameID: string;
  name: string;
};

export const loader: LoaderFunction = async ({ params }) => {
  return json({
    gameID: params.gameID,
    name: params.name
  });
};

export default function CollaborativeCheckmate() {
  const { gameID, name } = useLoaderData<LoaderData>();
  useNavigate();

  const [chess, setChess] = useState(new Chess());
  const [fen, setFen] = useState(chess.fen());
  const [lastMove, setLastMove] = useState<[string, string] | undefined>();
  const [gameOver, setGameOver] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(TURN_TIMER);
  const [playerRole, setPlayerRole] = useState<string | null>(null);
  const [boardOrientation, setBoardOrientation] = useState("white");
  const [showGameOverModal, setShowGameOverModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_, setSuggestedMove] = useState<{ from: string; to: string; fen: string } | null>(null);

  const suggestedMoveRef = useRef<{ from: string; to: string; fen: string } | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const remainingTimeRef = useRef(TURN_TIMER);

  const updateGameState = useCallback((gameData: any) => {
    const newChess = new Chess(gameData.fen);
    setChess(newChess);
    setFen(newChess.fen());
    const isOver = gameData.game_over;
    setGameOver(isOver ? determineGameOverReason(newChess) : "");
    if (isOver) setShowGameOverModal(true);
    if (gameData.last_move_from && gameData.last_move_to) {
      setLastMove([gameData.last_move_from, gameData.last_move_to]);
    }
  }, []);

  const determinePlayerRole = useCallback((gameData: any) => {
    if (gameData.w_one === name) setPlayerRole('w_one');
    else if (gameData.w_two === name) setPlayerRole('w_two');
    else if (gameData.b_one === name) setPlayerRole('b_one');
    else if (gameData.b_two === name) setPlayerRole('b_two');
    else setPlayerRole(null);
  }, [name]);

  const fetchGameState = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('game_id', gameID)
        .single();

      if (error) throw error;

      updateGameState(data);
      determinePlayerRole(data);
    } catch (error) {
      console.error('Error fetching game state:', error);
      setError('Failed to load game state. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [gameID, updateGameState, determinePlayerRole]);

  const handleGameUpdate = useCallback((payload: any) => {
    updateGameState(payload.new);
  }, [updateGameState]);

  useEffect(() => {
    const channel = supabase
      .channel(`game:${gameID}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, handleGameUpdate)
      .subscribe();

    fetchGameState();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameID, fetchGameState, handleGameUpdate]);

  const isPlayerTurn = useCallback(() => {
    return ((playerRole === 'w_one' || playerRole === 'w_two') && chess.turn() === 'w') ||
           ((playerRole === 'b_one' || playerRole === 'b_two') && chess.turn() === 'b');
  }, [chess, playerRole]);

  const submitMove = useCallback(async () => {
    if (!isPlayerTurn()) return;
    const currentSuggestedMove = suggestedMoveRef.current;
    if (!currentSuggestedMove) return;
  
    try {
      await supabase
        .from('move_selections')
        .upsert({
          game_id: gameID,
          player_name: playerRole,
          suggested_fen: currentSuggestedMove.fen
        });
  
      const { data, error: functionError } = await supabase.functions.invoke('evaluate-moves', {
        body: { gameID }
      });
  
      if (functionError) throw functionError;
  
      if (data.message !== 'Waiting for all players to submit moves') {
        await fetchGameState();
      }
    } catch (error) {
      console.error('Error submitting move or evaluating moves:', error);
      setError('Failed to submit move or evaluate moves. Please try again.');
    } finally {
      setSuggestedMove(null);
      suggestedMoveRef.current = null;
    }
  }, [gameID, isPlayerTurn, playerRole, fetchGameState]);

  useEffect(() => {
    const shouldStartTimer = isPlayerTurn() && !gameOver;
    if (shouldStartTimer) {
      remainingTimeRef.current = TURN_TIMER;
      setTimeRemaining(TURN_TIMER);

      const startTime = new Date().getTime();

      const updateTimer = () => {
        const now = new Date().getTime();
        const elapsed = Math.floor((now - startTime) / 1000);
        const remaining = Math.max(0, TURN_TIMER - elapsed);
        
        remainingTimeRef.current = remaining;
        setTimeRemaining(remaining);

        if (remaining === 0) {
          if (timerRef.current) clearInterval(timerRef.current);
          submitMove();
        }
      };

      timerRef.current = setInterval(updateTimer, 100);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [chess.turn(), gameOver, isPlayerTurn, submitMove]);

  const onMove = useCallback((from: string, to: string) => {
    if (isPlayerTurn() && !gameOver) {
      const newChess = new Chess(chess.fen());
      const move = newChess.move({ from, to, promotion: 'q' });
      if (move) {
        const newSuggestedMove = { from, to, fen: newChess.fen() };
        setSuggestedMove(newSuggestedMove);
        suggestedMoveRef.current = newSuggestedMove;
      }
    }
  }, [chess, isPlayerTurn, gameOver]);

  // const getLegalMoves = useCallback(() => {
  //   if (timeRemaining <= 0 || !chess) return new Map();
  //   const dests = new Map();
  //   chess.SQUARES?.forEach(s => {
  //     const ms = chess.moves({ square: s, verbose: true });
  //     if (ms?.length) dests.set(s, ms.map(m => m.to));
  //   });
  //   return dests;

  const getLegalMoves = useCallback(() => {
    const moves: string[] = [];

    const pieces = chess.board().flat().filter(piece => piece !== null);

    pieces.forEach(piece => {
      if (piece) {
        const square = piece.square as Square;
        const pieceMoves = chess.moves({ square, verbose: true });
        moves.push(...pieceMoves.map(m => `${square}${m.to}`));
      }
    });
    console.log(moves);

    return moves;
  }, [chess, timeRemaining]);

  const flipBoard = useCallback(() => {
    setBoardOrientation(prev => prev === "white" ? "black" : "white");
  }, []);

  const determineGameOverReason = useCallback((chessInstance: Chess) => {
    if (chessInstance.isCheckmate()) return "Checkmate";
    if (chessInstance.isDraw()) return "Draw";
    if (chessInstance.isStalemate()) return "Stalemate";
    if (chessInstance.isThreefoldRepetition()) return "Threefold Repetition";
    if (chessInstance.isInsufficientMaterial()) return "Insufficient Material";
    return "Game Over";
  }, []);

  if (isLoading) {
    return <div>Loading game...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="bg-background bg-fixed min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Article
          title="Collaborative Checkmate"
          subtitle={`Game ID: ${gameID} | Player: ${name} (Role: ${playerRole || 'Spectator'})`}
        >
          <Subarticle>
            <div className="mx-auto grid gap-x-4 grid-rows-2 md:grid-rows-1 grid-cols-1 md:grid-cols-2 md:ml-iauto" style={{ gridTemplateColumns: "80% 20%", marginLeft: "-0.5rem", marginRight: "0.5rem" }}>
              <div className="w-100% col-span-2 md:col-span-1">
                <ClientOnly fallback={<div>Loading...</div>}>
                  {() => (
                    <React.Suspense fallback={<div>Loading chess board...</div>}>
                      <ChessgroundWrapper
                        fen={fen}
                        orientation={boardOrientation}
                        turnColor={chess.turn()}
                        lastMove={lastMove}
                        onMove={onMove}
                        movable={{
                          free: false,
                          color: isPlayerTurn() ? chess.turn() : 'none',
                          dests: getLegalMoves(),
                          // events: { after: onMove },
                        }}
                        check={chess.isCheck()}
                        width="100%"
                        height="0"
                        style={{
                          paddingTop: '100%',
                          position: 'relative'
                        }}
                      />
                    </React.Suspense>
                  )}
                </ClientOnly>
              </div>

              <div className="justify-center text-center grid gap-y-3 h-80 md:h-full md:grid-cols-1 w-full grid-cols-3 col-span-2 md:col-span-1 gap-x-4 py-2 md:py-0">
                <div className="bg-white shadow rounded-lg overflow-hidden w-full col-span-3 md:col-span-1 md:h-60 h-36">
                  <div className="w-full text-gray border-b-2 z-30 bg-white border-green-500 py-0 md:py-2 inline-flex items-center justify-center font-bold text-sm md:text-md">
                    Game Info
                  </div>
                  <div className="flex flex-col items-center justify-center px-4 pb-0 -mt-3 z-10 md:py-2 bg-gray text-gray-light text-xs md:text-xs h-full overflow-y-hidden">
                    <p>Current Team: {chess.turn() === 'w' ? 'White' : 'Black'}</p>
                    <p>Your Role: {playerRole || 'Spectator'}</p>
                    {isPlayerTurn() && !gameOver && (
                      <p>Time Remaining: {timeRemaining} seconds</p>
                    )}
                    {gameOver && <p>Game Over: {gameOver}</p>}
                  </div>
                </div>

                <button
                  className="w-full bg-white text-gray-800 rounded border-b-2 border-green-500 hover:border-red-600 hover:bg-red-500 hover:text-white shadow-md py-2 px-6 inline-flex items-center"
                  onClick={flipBoard}
                  aria-label="Flip board orientation"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 mx-auto">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>
            </div>
          </Subarticle>
        </Article>
        <div className="visible">
          <Article title="About Collaborative Checkmate">
            <Subarticle subtitle="">
              <p>
                Collaborative Checkmate is a 2v2 chess variant where teammates work together to outmaneuver their opponents. Each player has 10 seconds to make a move, after which the best move from the team is selected. Coordinate with your partner and outsmart your opponents!
              </p>
            </Subarticle>
          </Article>
        </div>
      </main>
      <Footer />
      {showGameOverModal && (
        <Modal onClose={() => setShowGameOverModal(false)}>
          <div className="text-lg font-semibold text-gray-900">{gameOver}</div>
          <p className="mt-2 text-base text-gray-600">The game has ended. Thank you for playing!</p>
        </Modal>
      )}
    </div>
  );
}