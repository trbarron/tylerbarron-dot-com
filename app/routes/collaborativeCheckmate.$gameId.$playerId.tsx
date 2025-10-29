import { useState, useEffect, useRef } from "react";
import { Chess } from 'chess.js';
import Chessboard from '~/components/Chessboard';
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import chessgroundBase from '../styles/chessground.base.css?url';
import chessgroundBrown from '../styles/chessground.brown.css?url';
import chessgroundCburnett from '../styles/chessground.cburnett.css?url';
import { useLoaderData, type LinksFunction } from "react-router";
import Timer from "~/components/Timer";
import { GamePhase, type GamePhaseType, type SeatKey } from "~/types/generated";

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: chessgroundBase },
  { rel: 'stylesheet', href: chessgroundBrown },
  { rel: 'stylesheet', href: chessgroundCburnett }
];

// Define game phase names locally
const GamePhaseNames = {
  [GamePhase.SETUP]: 'Setup',
  [GamePhase.TEAM1_SELECTION]: 'White Selection',
  [GamePhase.TEAM1_COMPUTING]: 'White Computing',
  [GamePhase.TEAM2_SELECTION]: 'Black Selection',
  [GamePhase.TEAM2_COMPUTING]: 'Black Computing',
  [GamePhase.COOLDOWN]: 'Cooldown'
} as const;

// Type for game log entries
type GameLogEntry = {
  type: 'system' | 'move' | 'engine' | 'phase' | 'error' | 'game_over' | 'reconnecting';
  message: string;
  player?: string;
};

// Type for players state
type PlayersState = {
  [K in SeatKey]: {
    id: string | null;
    ready: boolean;
  };
};

export const loader = async ({ params }: { params: { gameId?: string; playerId?: string } }) => {
  const { gameId, playerId } = params;
  return Response.json({ gameId, playerId });
}

export default function CollaborativeCheckmate() {
  const { gameId, playerId } = useLoaderData<typeof loader>();
  const [chess, setChess] = useState(new Chess());
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [gamePhase, setGamePhase] = useState<GamePhaseType>(GamePhase.COOLDOWN);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [timeRemainingKey, setTimeRemainingKey] = useState<string | null>(null);
  const [playerTeam, setPlayerTeam] = useState<number | null>(null);
  const [players, setPlayers] = useState<PlayersState>({
    t1p1: { id: null, ready: false },
    t1p2: { id: null, ready: false },
    t2p1: { id: null, ready: false },
    t2p2: { id: null, ready: false }
  });
  const [shapes, setShapes] = useState([{ orig: 'e0', dest: 'e0', brush: 'green' }]);
  const [selectedMove, setSelectedMove] = useState(false);
  const [lockedIn, setLockedIn] = useState(false);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);
  const [connected, setConnected] = useState(false);

  // Add missing state variables
  const [lastMove, setLastMove] = useState<{from: string, to: string} | null>(null);
  const [submittedMoves, setSubmittedMoves] = useState<any[]>([]);
  const [teammateMoves, setTeammateMoves] = useState<any[]>([]);

  // Connection handling state
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastKnownSeat, setLastKnownSeat] = useState<SeatKey | null>(null);
  const [lastKnownReadyState, setLastKnownReadyState] = useState(false);
  const [hasReceivedInitialState, setHasReceivedInitialState] = useState(false);

  // Heartbeat state
  const [connectionId, setConnectionId] = useState<string>('');
  const [lastHeartbeatSent, setLastHeartbeatSent] = useState<number>(0);
  const [lastHeartbeatReceived, setLastHeartbeatReceived] = useState<number>(0);

  // WebSocket reference
  const socketRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnectionRef = useRef(false); // Track if current connection is a reconnection

  // Connection constants
  const MAX_RECONNECT_ATTEMPTS = 10;
  const INITIAL_RECONNECT_DELAY = 1000; // 1 second
  const MAX_RECONNECT_DELAY = 30000; // 30 seconds
  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const HEARTBEAT_TIMEOUT = 60000; // 60 seconds

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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array means this runs once on mount

  // Connect to WebSocket
  const connectWebSocket = (reconnection = false) => {
    try {
      isReconnectionRef.current = reconnection;
      
      // Generate new connection ID for this connection
      const newConnectionId = generateConnectionId();
      setConnectionId(newConnectionId);
      
      // Construct WebSocket URL
      const wsUrl = `wss://collaborative-checkmate-server.fly.dev/ws/game/${gameId}/player/${playerId}`;

      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        setConnected(true);
        setReconnecting(false);
        setReconnectAttempts(0);
        setHasReceivedInitialState(false); // Reset this flag on new connection
        
        // Start heartbeat mechanism with the new connection ID
        startHeartbeat(newConnectionId);
        
        if (isReconnectionRef.current) {
          setGameLog(prev => [...prev, { 
            type: 'system', 
            message: 'Successfully reconnected to game server. Waiting for game state...' 
          }]);
          // Don't call attemptStateRestoration immediately - wait for game state update
        } else {
          setGameLog(prev => [...prev, { 
            type: 'system', 
            message: 'Connected to game server' 
          }]);
        }
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`Received message: ${JSON.stringify(data)}`);

          // Handle different message types
          switch (data.type) {
            case 'connection_established':
              break;

            case 'heartbeat_response': {
              // Handle heartbeat response
              const responseTime = Date.now();
              setLastHeartbeatReceived(responseTime);
              
              // Clear heartbeat timeout since we received a response
              if (heartbeatTimeoutRef.current) {
                clearTimeout(heartbeatTimeoutRef.current);
                heartbeatTimeoutRef.current = null;
              }
              
              // Calculate round-trip time for debugging
              const roundTripTime = responseTime - lastHeartbeatSent;
              console.log(`Heartbeat RTT: ${roundTripTime}ms`);
              break;
            }

            case 'move_submitted':
              // Update player's submitted state
              setGameLog(prev => [...prev, {
                type: 'move',
                message: `${data.player_id} submitted a move`,
                player: ''
              }]);
              break;

            case 'player_ready': {
              // Update player's ready state
              const currentPlayers = playersRef.current;
              const seatKey = Object.keys(currentPlayers).find(key =>
                currentPlayers[key as SeatKey].id === data.player_id
              );

              if (seatKey) {
                // Update the ready status for this seat
                setPlayers(prev => ({
                  ...prev,
                  [seatKey]: { ...prev[seatKey as SeatKey], ready: true }
                }));

                // Store our own state when we become ready
                if (data.player_id === playerIdRef.current) {
                  setLastKnownSeat(seatKey as SeatKey);
                  setLastKnownReadyState(true);
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
            }

            case 'game_state_update':
              // Only update game phase if it's included in the update
              if (data.game_phase && data.game_phase !== gamePhase) {
                setGamePhase(data.game_phase);
                setGameLog(prev => [...prev, {
                  type: 'phase',
                  message: `Phase: ${GamePhaseNames[data.game_phase as GamePhaseType]}`
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
                setSelectedMove(false);
                setLockedIn(false);
              }

              if (data.last_move) {
                // Parse the last move from "e2e4" to "e2" and "e4"
                const move = data.last_move
                const from = move.substring(0, 2)
                const to = move.substring(2, 4)
                setShapes([{
                  orig: from,
                  dest: to,
                  brush: 'yellow'
                }]);
              }

              // Handle player seat/ready status updates if present
              {
              const seatUpdates: Partial<PlayersState> = {};
              (['t1p1', 't1p2', 't2p1', 't2p2'] as SeatKey[]).forEach(seat => {
                if (data[`${seat}_seat`] !== undefined || data[`${seat}_ready`] !== undefined) {
                  const seatId = data[`${seat}_seat`];
                  seatUpdates[seat] = {
                    id: seatId === "" ? null : (seatId ?? players[seat].id),
                    ready: data[`${seat}_ready`] === 'true' || false
                  };
                }
              });

              if (Object.keys(seatUpdates).length > 0) {
                setPlayers(prev => {
                  const newPlayers = { ...prev };
                  Object.entries(seatUpdates).forEach(([seat, info]) => {
                    if (info) {
                      newPlayers[seat as SeatKey] = info;
                    }
                  });
                  return newPlayers;
                });

                // Update player team based on their seat
                for (const [seat, info] of Object.entries(seatUpdates)) {
                  if (info && typeof info === 'object' && 'id' in info && info.id === playerIdRef.current) {
                    // Store our seat information when we take a seat
                    setLastKnownSeat(seat as SeatKey);
                    setLastKnownReadyState((info as any).ready || false);
                    
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

              // Check if this is the first state update after reconnection
              if (!hasReceivedInitialState && isReconnectionRef.current) {
                setHasReceivedInitialState(true);
                setGameLog(prev => [...prev, {
                  type: 'system',
                  message: 'Received game state. Checking seat assignment...'
                }]);
                
                // Immediately attempt state restoration, then clear reconnection flag
                setTimeout(() => {
                  attemptStateRestoration();
                  // Clear the reconnection flag after restoration is complete
                  setTimeout(() => {
                    isReconnectionRef.current = false;
                  }, 200);
                }, 100);
              } else if (!hasReceivedInitialState) {
                setHasReceivedInitialState(true);
              }
              }
              break;

            case 'timer_update':
              if (data.seconds_remaining !== undefined && data.seconds_remaining !== null) {
                const newTime = parseFloat(data.seconds_remaining);
                setTimeRemaining(newTime);
                setTimeRemainingKey(data.key);
              }
              break;

            case 'move_selected': {
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
              break;
            }

            case 'player_disconnected': {
              // Update player status to not ready
              const disconnectedSeatKey = Object.keys(players).find(key =>
                players[key as SeatKey].id === data.player_id
              );

              if (disconnectedSeatKey) {
                setPlayers(prev => ({
                  ...prev,
                  [disconnectedSeatKey]: { ...prev[disconnectedSeatKey as SeatKey], ready: false }
                }));
              }

              setGameLog(prev => [...prev, {
                type: 'system',
                message: `${data.player_id} disconnected`
              }]);
              break;
            }

            case 'game_over':
              // Handle game over messages (checkmate, stalemate, etc.)
              setGameLog(prev => [...prev, {
                type: 'game_over',
                message: data.message || `Game Over! ${data.result}`
              }]);

              // Add additional game details if available
              if (data.total_moves) {
                setGameLog(prev => [...prev, {
                  type: 'system',
                  message: `Total moves: ${data.total_moves}`
                }]);
              }

              if (data.team_coordination) {
                setGameLog(prev => [...prev, {
                  type: 'system',
                  message: `Team coordination - Team 1: ${data.team_coordination.team1_same_moves}, Team 2: ${data.team_coordination.team2_same_moves}`
                }]);
              }

              // Update the chess position to the final position
              if (data.final_position) {
                chess.load(data.final_position);
                setFen(data.final_position);
                setChess(new Chess(data.final_position));
              }
              break;

            default:
              console.log(`Unknown message type: ${data.type}`);
          }
        } catch (e) {
          console.log(`Error parsing message: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      };

      socketRef.current.onclose = (event) => {
        setConnected(false);
        
        // Stop heartbeat mechanism
        stopHeartbeat();
        
        // Store current state before attempting reconnection
        storePlayerState();
        
        // Only attempt reconnection if this wasn't an intentional close
        if (event.code !== 1000 && !reconnecting) {
          setReconnecting(true);
          setGameLog(prev => [...prev, {
            type: 'system',
            message: 'Connection lost. Attempting to reconnect...'
          }]);
          attemptReconnect();
        } else if (!reconnecting) {
          setGameLog(prev => [...prev, {
            type: 'system',
            message: 'Disconnected from game server'
          }]);
        }
      };

      socketRef.current.onerror = () => {
        console.log(`WebSocket error: Unknown error`);
        
        if (!reconnecting) {
          setGameLog(prev => [...prev, {
            type: 'error',
            message: 'Connection error occurred'
          }]);
        }
      };
    } catch (e) {
      console.log(`Error connecting to WebSocket: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  // Take a specific seat
  const takeSeat = (seat: SeatKey) => {
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
    setLockedIn(true);
  };

  // Find which seat the current player is in, if any
  const getCurrentPlayerSeat = (): SeatKey | null => {
    return Object.entries(playersRef.current).find(
      ([, player]) => player.id === playerIdRef.current
    )?.[0] as SeatKey || null;
  };

  // Helper function to calculate reconnect delay with exponential backoff
  const getReconnectDelay = (attempts: number) => {
    const delay = Math.min(INITIAL_RECONNECT_DELAY * Math.pow(2, attempts), MAX_RECONNECT_DELAY);
    return delay + Math.random() * 1000; // Add jitter
  };

  // Helper function to store current player state before disconnection
  const storePlayerState = () => {
    const currentSeat = getCurrentPlayerSeat();
    if (currentSeat) {
      setLastKnownSeat(currentSeat);
      setLastKnownReadyState(playersRef.current[currentSeat]?.ready || false);
    }
  };

  // Helper function to attempt to restore player state after reconnection
  const attemptStateRestoration = () => {
    // First, check if we're already in a seat according to current game state
    const currentSeat = getCurrentPlayerSeat();
    
    if (currentSeat) {
      // We're already in a seat, just update our local state
      setLastKnownSeat(currentSeat);
      const isReady = playersRef.current[currentSeat]?.ready || false;
      setLastKnownReadyState(isReady);
      
      // Update team assignment based on current seat
      if (currentSeat.startsWith('t1')) {
        setPlayerTeam(1);
        setOrientation('white');
      } else if (currentSeat.startsWith('t2')) {
        setPlayerTeam(2);
        setOrientation('black');
      }
      
      setGameLog(prev => [...prev, {
        type: 'system',
        message: `Found existing seat: ${currentSeat} (ready: ${isReady})`
      }]);
      
      return; // No need to try to take a seat
    }
    
    // If we're not in any seat but have a last known seat, try to retake it
    if (lastKnownSeat && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      setGameLog(prev => [...prev, {
        type: 'system',
        message: `No current seat found. Attempting to restore seat: ${lastKnownSeat} (ready: ${lastKnownReadyState})`
      }]);

      // Wait a moment for the server to be ready, then try to take the same seat
      setTimeout(() => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({
            type: "take_seat",
            seat: lastKnownSeat
          }));

          // If they were ready before, try to ready up again after the seat is taken
          if (lastKnownReadyState) {
            setTimeout(() => {
              if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({
                  type: "ready",
                  player_id: playerId
                }));
                setGameLog(prev => [...prev, {
                  type: 'system',
                  message: `Attempting to restore ready state...`
                }]);
              }
            }, 1000); // Wait 1 second for seat to be confirmed
          }
        }
      }, 500); // Wait 500ms for server to be ready
    } else if (!lastKnownSeat) {
      setGameLog(prev => [...prev, {
        type: 'system',
        message: `No seat to restore - starting fresh`
      }]);
    } else {
      setGameLog(prev => [...prev, {
        type: 'system',
        message: `Cannot restore state - connection not ready`
      }]);
    }
  };

  // Reconnection function
  const attemptReconnect = () => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setGameLog(prev => [...prev, {
        type: 'error',
        message: `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts. Please refresh the page.`
      }]);
      setReconnecting(false);
      return;
    }

    const delay = getReconnectDelay(reconnectAttempts);
    setReconnectAttempts(prev => prev + 1);
    
    setGameLog(prev => [...prev, {
      type: 'system',
      message: `Attempting to reconnect... (${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`
    }]);

    reconnectTimeoutRef.current = setTimeout(() => {
      connectWebSocket(true); // Pass true to indicate this is a reconnection
    }, delay);
  };

  // Generate unique connection ID
  const generateConnectionId = () => {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Send heartbeat to server
  const sendHeartbeat = (connectionId: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const timestamp = Date.now();
      setLastHeartbeatSent(timestamp);
      
      socketRef.current.send(JSON.stringify({
        type: "heartbeat",
        timestamp: timestamp,
        connectionId: connectionId
      }));

      // Set timeout for heartbeat response
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
      
      heartbeatTimeoutRef.current = setTimeout(() => {
        setGameLog(prev => [...prev, {
          type: 'error',
          message: 'Heartbeat timeout - connection may be lost'
        }]);
        
        // Trigger reconnection on heartbeat timeout
        if (socketRef.current) {
          socketRef.current.close();
        }
      }, HEARTBEAT_TIMEOUT);
    }
  };

  // Start heartbeat interval
  const startHeartbeat = (connectionId: string) => {
    // Clear any existing heartbeat interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    // Send initial heartbeat
    sendHeartbeat(connectionId);
    
    // Set up regular heartbeat interval
    heartbeatIntervalRef.current = setInterval(() => {
      sendHeartbeat(connectionId);
    }, HEARTBEAT_INTERVAL);
  };

  // Stop heartbeat
  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
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
                        (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2)) || lockedIn}
                      movable={!!playerTeam && ((gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1) ||
                        (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2)) && !lockedIn}
                      events={{
                        move: (orig, dest) => {
                          // Instead of making the move, draw an arrow and send to server
                          if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
                            const chessCopy = new Chess(fen);
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
                            setSelectedMove(true);


                            setShapes([{
                              orig: orig,
                              dest: dest,
                              brush: 'blue'
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
                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gamePhase === GamePhase.TEAM1_SELECTION ? 'bg-gray-500' : 'bg-gray-300'
                    } flex items-center justify-center text-xs text-white font-bold ml-0`}>•</div>
                  <div className="flex-grow h-2"></div>

                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gamePhase === GamePhase.TEAM1_COMPUTING ? 'bg-gray-500' : 'bg-gray-300'
                    } flex items-center justify-center text-xs text-white font-bold`}>•</div>
                  <div className="flex-grow h-2"></div>

                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gamePhase === GamePhase.TEAM2_COMPUTING ? 'bg-gray-500' : 'bg-gray-300'
                    } flex items-center justify-center text-xs text-white font-bold mr-0`}>•</div>
                  <div className="flex-grow h-2"></div>

                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-white ${gamePhase === GamePhase.TEAM2_SELECTION ? 'bg-gray-500' : 'bg-gray-300'
                    } flex items-center justify-center text-xs text-white font-bold`}>•</div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="bg-white text-black px-2 py-1">Select</span>
                  <span className="bg-white text-black px-2 py-1">Compute</span>
                  <span className="bg-gray-700 text-white px-2 py-1">Compute</span>
                  <span className="bg-gray-700 text-white px-2 py-1">Select</span>
                </div>
              </div>

              {/* Lock In Move Button */}
              <div className="grid grid-cols-1 gap-2 mb-12">
                <button
                  onClick={lockInMove}
                  className={`p-2 rounded font-bold transition-colors duration-200
                    ${!connected || !selectedMove || lockedIn
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-500 hover:bg-gray-600 text-white'
                    }`}
                  disabled={!connected || !selectedMove || lockedIn}
                >
                  Lock In Move
                </button>
              </div>

              {/* Player Seats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white shadow rounded p-3 pt-0 mb-2">
                  <h3 className="font-bold text-gray-500 text-lg my-1">White</h3>
                  <div className="space-y-2">
                    {/* White Player 1 */}
                    <div
                      className={`flex items-center p-2 rounded ${players.t1p1.id === playerId ? 'bg-blue-100' : ''
                        } ${(players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => ((players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready) && takeSeat('t1p1')}
                      onKeyDown={(e) => e.key === 'Enter' && ((players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready) && takeSeat('t1p1')}
                      role="button"
                      tabIndex={0}
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
                      onKeyDown={(e) => e.key === 'Enter' && ((players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready) && takeSeat('t1p2')}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${players.t1p2.ready ? 'bg-green-500' : 'bg-gray-200'
                        }`}></div>
                      <span>{players.t1p2.id || '<Click to Join>'}</span>
                      {players.t1p2.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>
                  </div>
                </div>

                <div className="bg-white shadow rounded p-3 pt-0 mb-2">
                  <h3 className="font-bold text-gray-500 text-lg my-1">Black</h3>
                  <div className="space-y-2">
                    {/* Black Player 1 */}
                    <div
                      className={`flex items-center p-2 rounded ${players.t2p1.id === playerId ? 'bg-blue-100' : ''
                        } ${(players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready ?
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' :
                          'border border-gray-200'
                        }`}
                      onClick={() => ((players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready) && takeSeat('t2p1')}
                      onKeyDown={(e) => e.key === 'Enter' && ((players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready) && takeSeat('t2p1')}
                      role="button"
                      tabIndex={0}
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
                      onKeyDown={(e) => e.key === 'Enter' && ((players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready) && takeSeat('t2p2')}
                      role="button"
                      tabIndex={0}
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
                    ${!connected || (players.t1p1.id != playerId && players.t1p2.id != playerId && players.t2p1.id != playerId && players.t2p2.id != playerId) || (getCurrentPlayerSeat() !== null && players[getCurrentPlayerSeat()!].ready)
                      ? 'bg-purple-300 text-purple-100 cursor-not-allowed'
                      : 'bg-purple-500 hover:bg-purple-600 text-white'
                    }`}
                  disabled={!connected || (players.t1p1.id != playerId && players.t1p2.id != playerId && players.t2p1.id != playerId && players.t2p2.id != playerId) || (getCurrentPlayerSeat() !== null && players[getCurrentPlayerSeat()!].ready)}
                >
                  Ready Up
                </button>
              </div>
            </div>

            {/* Game log panel */}
            <div className="md:col-span-1">
              {/* Game log */}
              <div className="bg-white shadow rounded overflow-hidden mb-4">
                <div className="border-b-2 border-green-500 p-2 font-bold bg-white flex justify-between items-center">
                  <span>Game Log</span>
                  {reconnecting && (
                    <span className="text-xs text-orange-600 font-normal flex items-center">
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500 mr-1"></div>
                      Reconnecting...
                    </span>
                  )}
                  {!connected && !reconnecting && (
                    <span className="text-xs text-red-600 font-normal">
                      Disconnected
                    </span>
                  )}
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
                          entry.type === 'phase' ? 'bg-white' :
                            entry.type === 'error' ? 'bg-red-50' :
                              entry.type === 'game_over' ? 'bg-purple-50' :
                                entry.type === 'reconnecting' ? 'bg-orange-50' : ''
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