import React, { useState, useEffect, useRef, memo, useMemo } from "react";
import { Chess } from 'chess.js';
import Chessboard from '~/components/Chessboard';
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import chessgroundBase from '../styles/chessground.base.css';
import chessgroundBrown from '../styles/chessground.brown.css';
import chessgroundCburnett from '../styles/chessground.cburnett.css';
import type { LinksFunction, LoaderFunction } from '@remix-run/node';
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import Timer from "~/components/Timer";

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: chessgroundBase },
  { rel: 'stylesheet', href: chessgroundBrown },
  { rel: 'stylesheet', href: chessgroundCburnett }
];

// Define game phases as constants
const GamePhase = {
  SETUP: 'setup',
  TEAM1_SELECTION: 'team1_selection',
  TEAM1_COMPUTING: 'team1_computing',
  TEAM2_SELECTION: 'team2_selection',
  TEAM2_COMPUTING: 'team2_computing',
  COOLDOWN: 'cooldown'
} as const;

// Type for the game phases
type GamePhaseType = typeof GamePhase[keyof typeof GamePhase];

export const loader: LoaderFunction = async ({ params }) => {
  const { gameId, playerId } = params;
  return json({ gameId, playerId });
}

export default function CollaborativeCheckmate() {
  const { gameId, playerId } = useLoaderData<typeof loader>();
  const [chess, setChess] = useState(new Chess());
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [orientation, setOrientation] = useState('white');
  const [selectedMove, setSelectedMove] = useState(null);
  const [gamePhase, setGamePhase] = useState<GamePhaseType>(GamePhase.COOLDOWN);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeRemainingKey, setTimeRemainingKey] = useState(null);
  const [playerTeam, setPlayerTeam] = useState(null);
  const [players, setPlayers] = useState({
    t1p1: { id: null, ready: false },
    t1p2: { id: null, ready: false },
    t2p1: { id: null, ready: false },
    t2p2: { id: null, ready: false }
  });
  const [shapes, setShapes] = useState([{ orig: 'e0', dest: 'e0', brush: 'green' }]);
  const [gameLog, setGameLog] = useState([]);
  const [connected, setConnected] = useState(false);

  // WebSocket reference
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  // Use refs to keep track of current state values for use in callbacks
  const playersRef = useRef(players);
  const playerIdRef = useRef(playerId);
  const gamePhaseRef = useRef(gamePhase);
  const playerTeamRef = useRef(playerTeam);

  const timeRemainingRef = useRef(0);

  // Update refs when state changes
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    gamePhaseRef.current = gamePhase;
  }, [gamePhase]);

  useEffect(() => {
    playerTeamRef.current = playerTeam;
  }, [playerTeam]);

  useEffect(() => {
    timeRemainingRef.current = timeRemaining;
  }, [timeRemaining]);

  // Connect to WebSocket on component mount
  useEffect(() => {
    setTimeout(() => {
      connectWebSocket();
    }, 1000);

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // Connect to WebSocket
  const connectWebSocket = () => {
    try {
      // Connect to the local FastAPI backend
      socketRef.current = new WebSocket(`wss://collaborative-checkmate-server.fly.dev/ws/game/${gameId}/player/${playerId}`);

      socketRef.current.onopen = () => {
        setConnected(true);
        setGameLog(prev => [...prev, { type: 'system', message: 'Connected to game server' }]);
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle different message types
          switch (data.type) {
            case 'connection_established':
              break;

            case 'moves_submitted':
              // Update player's submitted state
              setGameLog(prev => [...prev, {
                type: 'move',
                message: `${data.player_id} submitted a move`,
                player: data.player_id === playerId ? 'You' : 'Teammate'
              }]);
              break;

            case 'player_ready':
              // Update player's ready state
              const currentPlayers = playersRef.current;
              const seatKey = Object.keys(currentPlayers).find(key =>
                currentPlayers[key].id === data.player_id
              );

              if (seatKey) {
                // Update the ready status for this seat
                setPlayers(prev => ({
                  ...prev,
                  [seatKey]: { ...prev[seatKey], ready: true }
                }));

                // If this is the current player, add a note to the log
                if (data.player_id === playerIdRef.current) {
                  setGameLog(prev => [...prev, {
                    type: 'system',
                    message: `You are now ready. You cannot change seats until the game ends.`
                  }]);
                } else {
                  setGameLog(prev => [...prev, {
                    type: 'system',
                    message: `${data.player_id} is ready`
                  }]);
                }
              } else {
                setGameLog(prev => [...prev, {
                  type: 'system',
                  message: `${data.player_id} is ready`
                }]);
              }
              break;

            case 'game_state_update':
              // Only update game phase if it's included in the update
              if (data.game_phase && data.game_phase !== gamePhase) {
                setGamePhase(data.game_phase);
                setGameLog(prev => [...prev, {
                  type: 'phase',
                  message: `Phase changed to ${data.game_phase}`
                }]);
              }

              // Only update duration/time if it's included
              if (data.duration !== undefined) {
                setTimeRemaining(data.duration);
              }

              // Only update chess position if FEN is included
              if (data.fen) {
                chess.load(data.fen);
                setFen(data.fen);
                setChess(new Chess(data.fen));
                setShapes([{ orig: 'e0', dest: 'e0', brush: 'green' }]);
              }

              // Handle player seat/ready status updates if present
              const seatUpdates = {};
              ['t1p1', 't1p2', 't2p1', 't2p2'].forEach(seat => {
                if (data[`${seat}_seat`] !== undefined || data[`${seat}_ready`] !== undefined) {
                  const seatId = data[`${seat}_seat`];
                  seatUpdates[seat] = {
                    id: seatId === "" ? null : (seatId ?? players[seat].id),
                    ready: data[`${seat}_ready`] === 'true' || false
                  };
                }
              });

              if (Object.keys(seatUpdates).length > 0) {
                setPlayers(prev => ({
                  ...prev,
                  ...seatUpdates
                }));

                // Update player team based on their seat
                for (const [seat, info] of Object.entries(seatUpdates)) {
                  if (info.id === playerIdRef.current) {
                    if (seat.startsWith('t1')) {
                      setPlayerTeam(1);
                      setOrientation('white');
                    } else if (seat.startsWith('t2')) {
                      setPlayerTeam(2);
                      setOrientation('black');
                    }
                    break;
                  }
                }

                setGameLog(prev => [...prev, {
                  type: 'system',
                  message: `Player seats updated`
                }]);
              }
              break;

            case 'timer_update':
              if (data.seconds_remaining !== undefined && data.seconds_remaining !== null) {
                const newTime = parseFloat(data.seconds_remaining);
                setTimeRemaining(newTime);
                setTimeRemainingKey(data.key);
              }
              break;

            case 'move_selected':
              const moveText = `${data.move.from} to ${data.move.to}`;
              setGameLog(prev => [...prev, {
                type: 'engine',
                message: `Engine selected move: ${moveText} (by ${data.move.submitted_by})`
              }]);

              // Set the last move for animation purposes
              setLastMove({
                from: data.move.from,
                to: data.move.to
              });

              // Reset selections for next turn
              setSubmittedMoves([]);
              setTeammateMoves([]);
              setSelectedMove(null);
              break;

            case 'player_disconnected':
              // Update player status to not ready
              const disconnectedSeatKey = Object.keys(players).find(key =>
                players[key].id === data.player_id
              );

              if (disconnectedSeatKey) {
                setPlayers(prev => ({
                  ...prev,
                  [disconnectedSeatKey]: { ...prev[disconnectedSeatKey], ready: false }
                }));
              }

              setGameLog(prev => [...prev, {
                type: 'system',
                message: `${data.player_id} disconnected`
              }]);
              break;

            default:
              console.log(`Unknown message type: ${data.type}`);
          }
        } catch (e) {
          console.log(`Error parsing message: ${e.message}`);
        }
      };

      socketRef.current.onclose = (event) => {
        setConnected(false);
        setGameLog(prev => [...prev, {
          type: 'system',
          message: 'Disconnected from game server'
        }]);
      };

      socketRef.current.onerror = (error) => {
        console.log(`WebSocket error: ${error.message}`);
        setGameLog(prev => [...prev, {
          type: 'error',
          message: 'Connection error'
        }]);
      };
    } catch (e) {
      console.log(`Error connecting to WebSocket: ${e.message}`);
    }
  };

  // Take a specific seat
  const takeSeat = (seat) => {
    if (!connected) {
      setGameLog(prev => [...prev, {
        type: 'error',
        message: 'Cannot take seat: Not connected'
      }]);
      return;
    }

    // Check if player has already readied up - can't change seats if ready
    const currentSeat = getCurrentPlayerSeat();
    const currentPlayerReady = currentSeat ? playersRef.current[currentSeat]?.ready : false;

    if (currentSeat && currentPlayerReady) {
      setGameLog(prev => [...prev, {
        type: 'error',
        message: 'Cannot change seats after readying up'
      }]);
      return;
    }

    // Check if seat is already taken by someone else (can click on your own seat)
    const currentPlayers = playersRef.current;
    if (currentPlayers[seat]?.id !== null && currentPlayers[seat]?.id !== playerIdRef.current) {
      setGameLog(prev => [...prev, {
        type: 'error',
        message: `Seat ${seat} is already taken by ${currentPlayers[seat].id}`
      }]);
      return;
    }

    // Send request to take seat
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "take_seat",
        seat: seat
      }));
    }
  };

  const readyUp = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "ready",
        player_id: playerId
      }));

    } else {
      setGameLog(prev => [...prev, {
        type: 'error',
        message: 'Cannot ready up: Not connected'
      }]);
    }
  };

  const lockInMove = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "lock_in_move",
        player_id: playerId
      }));
    }
  };

  // Find which seat the current player is in, if any
  const getCurrentPlayerSeat = () => {
    return Object.entries(playersRef.current).find(
      ([_, player]) => player.id === playerIdRef.current
    )?.[0] || null;
  };

  return (
    <div className="bg-background bg-fixed min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Article title="Collaborative Checkmate" subtitle="">
          <div className="pb-6 mx-auto grid gap-6 grid-cols-1 md:grid-cols-3">
            {/* Chessboard */}
            <div className="md:col-span-2">
              <div className="mb-4">
                <div className={`mb-4 p-2 rounded transition-all duration-300 ${(gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1)
                  ? 'bg-white'
                  : (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2)
                    ? 'bg-black'
                    : 'bg-transparent'
                  }`}>
                  <div className="relative">
                    {/* Turn indicator banner */}
                    {((gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1) ||
                      (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2))}
                    <Chessboard
                      initialFen={fen}
                      orientation={orientation}
                      viewOnly={!((gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1) ||
                        (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2))}
                      movable={{
                        free: false,
                        color: playerTeam === 1 ? 'white' : 'black'
                      }}
                      events={{
                        move: (orig, dest) => {
                          // Instead of making the move, draw an arrow and send to server
                          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                            let chessCopy = new Chess(fen);
                            chessCopy.move({ from: orig, to: dest, promotion: 'q' });
                            socketRef.current.send(JSON.stringify({
                              type: "submit_move",
                              player_id: playerId,
                              move: chessCopy.fen()
                            }));

                            // Reset position to original FEN
                            chess.load(fen);
                            setFen(fen);
                            setChess(new Chess(fen));

                            setShapes([{
                              orig: orig,
                              dest: dest,
                              brush: 'yellow'
                            }]);
                          }
                        }
                      }}
                      drawable={{
                        enabled: true,
                        visible: true,
                        defaultSnapToValidMove: true,
                        eraseOnClick: true,
                        autoShapes: shapes
                      }}
                    />
                  </div>
                </div>
              </div>


              {/* Game Phase Indicator */}
              <div className="bg-white shadow rounded p-4 mb-2">
                <Timer 
                  timeRemaining={timeRemaining} 
                  key={timeRemainingKey}
                />
                <div className="relative h-12 flex items-center">
                  <div className="absolute w-full h-2 bg-gray-200 rounded-full"></div>

                  {/* Phase Markers */}
                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gamePhase === GamePhase.TEAM1_SELECTION ? 'bg-green-500' : 'bg-gray-300'
                    } flex items-center justify-center text-xs text-white font-bold ml-0`}>•</div>
                  <div className="flex-grow h-2"></div>

                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gamePhase === GamePhase.TEAM1_COMPUTING ? 'bg-blue-500' : 'bg-gray-300'
                    } flex items-center justify-center text-xs text-white font-bold`}>•</div>
                  <div className="flex-grow h-2"></div>

                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-black ${gamePhase === GamePhase.TEAM2_COMPUTING ? 'bg-blue-500' : 'bg-gray-300'
                    } flex items-center justify-center text-xs text-black font-bold mr-0`}>•</div>
                  <div className="flex-grow h-2"></div>

                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-black ${gamePhase === GamePhase.TEAM2_SELECTION ? 'bg-green-500' : 'bg-gray-300'
                    } flex items-center justify-center text-xs text-black font-bold`}>•</div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="bg-white text-black px-2 py-1">Select</span>
                  <span className="bg-white text-black px-2 py-1">Compute</span>
                  <span className="bg-black text-white px-2 py-1">Compute</span>
                  <span className="bg-black text-white px-2 py-1">Select</span>
                </div>
              </div>

              {/* Lock In Move Button */}
              <div className="grid grid-cols-1 gap-2 mb-12">
                <button
                  onClick={lockInMove}
                  className={`p-2 rounded font-bold transition-colors duration-200
                    ${!connected || !selectedMove 
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                    }`}
                  disabled={!connected || !selectedMove}
                >
                  Lock In Move
                </button>
              </div>

              {/* Player Seats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white shadow rounded p-3 pt-0 mb-2">
                  <h3 className="font-bold text-lg my-1">White</h3>
                  <div className="space-y-2">
                    {/* White Player 1 */}
                    <div
                      className={`flex items-center p-2 rounded ${players.t1p1.id === playerId ? 'bg-blue-100' : ''
                        } ${(players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => ((players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready) && takeSeat('t1p1')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${players.t1p1.ready ? 'bg-green-500' : 'bg-gray-200'
                        }`}></div>
                      <span>{players.t1p1.id || '< Click to Join >'}</span>
                      {players.t1p1.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>

                    {/* White Player 2 */}
                    <div
                      className={`flex items-center p-2 rounded ${players.t1p2.id === playerId ? 'bg-blue-100' : ''
                        } ${(players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => ((players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready) && takeSeat('t1p2')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${players.t1p2.ready ? 'bg-green-500' : 'bg-gray-200'
                        }`}></div>
                      <span>{players.t1p2.id || '<Click to Join>'}</span>
                      {players.t1p2.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>
                  </div>
                </div>

                <div className="bg-white shadow rounded p-3 pt-0 mb-2">
                  <h3 className="font-bold text-lg my-1">Black</h3>
                  <div className="space-y-2">
                    {/* Black Player 1 */}
                    <div
                      className={`flex items-center p-2 rounded ${players.t2p1.id === playerId ? 'bg-blue-100' : ''
                        } ${(players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => ((players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready) && takeSeat('t2p1')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${players.t2p1.ready ? 'bg-green-500' : 'bg-gray-200'
                        }`}></div>
                      <span>{players.t2p1.id || '< Click to Join >'}</span>
                      {players.t2p1.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>

                    {/* Black Player 2 */}
                    <div
                      className={`flex items-center p-2 rounded ${players.t2p2.id === playerId ? 'bg-blue-100' : ''
                        } ${(players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => ((players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready) && takeSeat('t2p2')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${players.t2p2.ready ? 'bg-green-500' : 'bg-gray-200'
                        }`}></div>
                      <span>{players.t2p2.id || '< Click to Join >'}</span>
                      {players.t2p2.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ready Up Button */}
              <div className="grid grid-cols-1 gap-2 mb-4">
                <button
                  onClick={readyUp}
                  className={`p-2 rounded font-bold transition-colors duration-200
                    ${!connected || (players.t1p1.id != playerId && players.t1p2.id != playerId && players.t2p1.id != playerId && players.t2p2.id != playerId) || (getCurrentPlayerSeat() && players[getCurrentPlayerSeat()].ready)
                      ? 'bg-purple-300 text-purple-100 cursor-not-allowed'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                    }`}
                  disabled={!connected || (players.t1p1.id != playerId && players.t1p2.id != playerId && players.t2p1.id != playerId && players.t2p2.id != playerId) || (getCurrentPlayerSeat() && players[getCurrentPlayerSeat()].ready)}
                >
                  Ready Up
                </button>
              </div>
            </div>

            {/* Game log panel */}
            <div className="md:col-span-1">
              {/* Game log */}
              <div className="bg-white shadow rounded overflow-hidden mb-4">
                <div className="border-b-2 border-green-500 p-2 font-bold bg-white">
                  Game Log
                </div>
                <div
                  className="h-96 overflow-y-auto p-2 bg-gray-50"
                  ref={(el) => {
                    if (el) {
                      el.scrollTop = el.scrollHeight;
                    }
                  }}
                >
                  {gameLog.map((entry, index) => (
                    <div key={index} className={`mb-1 p-1 rounded text-xs ${entry.type === 'system' ? 'bg-gray-100' :
                      entry.type === 'move' ? 'bg-blue-50' :
                        entry.type === 'engine' ? 'bg-yellow-50' :
                          entry.type === 'phase' ? 'bg-green-50' :
                            entry.type === 'error' ? 'bg-red-50' : ''
                      }`}>
                      {entry.player && <span className="font-bold">{entry.player}: </span>}
                      {entry.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Article>
      </main>
      <Footer />
    </div>
  );
}