import React, { useState, useEffect, useRef } from "react";
import { Chess } from 'chess.js';
import Chessboard from '~/components/Chessboard';
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import chessgroundBase from '../styles/chessground.base.css';
import chessgroundBrown from '../styles/chessground.brown.css';
import chessgroundCburnett from '../styles/chessground.cburnett.css';
import type { LinksFunction, LoaderFunction } from '@remix-run/node';

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

export default function CollaborativeCheckmate() {
  const [chess, setChess] = useState(new Chess());
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [orientation, setOrientation] = useState('white');
  const [selectedMove, setSelectedMove] = useState(null);
  const [phase, setPhase] = useState<GamePhaseType>(GamePhase.SETUP);
  const [timeRemaining, setTimeRemaining] = useState(5);
  const [gameId, setGameId] = useState('test-game-' + Math.random().toString(36).substring(2, 9));
  const [playerTeam, setPlayerTeam] = useState(1);
  const [playerId, setPlayerId] = useState('player1');
  const [players, setPlayers] = useState({
    t1p1: { id: null, ready: false },
    t1p2: { id: null, ready: false },
    t2p1: { id: null, ready: false },
    t2p2: { id: null, ready: false }
  });
  const [gameLog, setGameLog] = useState([]);
  const [connected, setConnected] = useState(false);
  
  // WebSocket reference
  const socketRef = useRef(null);
  const timerRef = useRef(null);
  
  // Use refs to keep track of current state values for use in callbacks
  const playersRef = useRef(players);
  const playerIdRef = useRef(playerId);
  const phaseRef = useRef(phase);
  const playerTeamRef = useRef(playerTeam);
  
  // Update refs when state changes
  useEffect(() => {
    playersRef.current = players;
  }, [players]);
  
  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);
  
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  
  useEffect(() => {
    playerTeamRef.current = playerTeam;
  }, [playerTeam]);

  
  // Connect to WebSocket
  const connectWebSocket = () => {
    try {
      // Connect to the local FastAPI backend
      socketRef.current = new WebSocket(`ws://localhost:8000/ws/game/${gameId}`);
      
      socketRef.current.onopen = () => {
        setConnected(true);
        setGameLog(prev => [...prev, { type: 'system', message: 'Connected to game server' }]);
      };
      
      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(`Received message: ${JSON.stringify(data)}`);
          
          // Handle different message types
          switch(data.type) {
            case 'connection_established':
              setPlayerId(data.player_id);
              break;
              
            case 'player_joined':
              setGameLog(prev => [...prev, { 
                type: 'system', 
                message: `${data.player_id} joined Team ${data.team}` 
              }]);
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
              
            case 'game_state_set':
              setPhase(data.phase);
              setTimeRemaining(data.duration || 5);
              setGameLog(prev => [...prev, { 
                type: 'phase', 
                message: `Phase changed to ${data.phase} (${data.duration || 5} seconds)`
              }]);
              chess.fen = data.fen;
              setFen(data.fen);
              setChess(new Chess(data.fen));
              break;

            case 'player_seats':
              if (data.player_seats) {
                setPlayers(prev => {
                  const updatedPlayers = {};
                  for (const seat of Object.keys(prev)) {
                    updatedPlayers[seat] = {
                      id: data.player_seats[seat] || null,
                      ready: prev[seat].ready
                    };
                  }
                  return updatedPlayers;
                });
                
                // Determine our team based on which seat we're in
                for (const [seat, playerId] of Object.entries(data.player_seats)) {
                  if (playerId === playerIdRef.current) {
                    if (seat.startsWith('t1')) {
                      setPlayerTeam(1);
                    } else if (seat.startsWith('t2')) {
                      setPlayerTeam(2);
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
              setTimeRemaining(data.seconds_remaining);
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
        console.log(`Disconnected from server: code=${event.code} reason=${event.reason || 'No reason provided'}`);
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
  
  // Disconnect from WebSocket
  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
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
    const currentPlayerReady = playersRef.current[currentSeat].ready;
    
    if (currentSeat && currentPlayerReady) {
      setGameLog(prev => [...prev, { 
        type: 'error', 
        message: 'Cannot change seats after readying up' 
      }]);
      return;
    }
    
    // Check if seat is already taken by someone else (can click on your own seat)
    const currentPlayers = playersRef.current;
    if (currentPlayers[seat].id !== null && currentPlayers[seat].id !== playerIdRef.current) {
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
      
      console.log(`Requested to take seat ${seat}`);
      // The actual seat update will happen when we receive the player_seats message
    }
  };

  const readyUp = () => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "ready",
        player_id: playerId
      }));
      
      console.log(`Player ${playerId} ready`);
    } else {
      console.log('Cannot ready up: Not connected to server');
      setGameLog(prev => [...prev, { 
        type: 'error', 
        message: 'Cannot ready up: Not connected' 
      }]);
    }
  };
   
  // Handle clicking on the board to select a move
  const handleBoardClick = (sourceSquare, targetSquare) => {};
  
  // Find which seat the current player is in, if any
  const getCurrentPlayerSeat = () => {
    return Object.entries(playersRef.current).find(
      ([_, player]) => player.id === playerIdRef.current
    )?.[0] || null;
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);
  
  return (
    <div className="bg-background bg-fixed min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Article title="Collaborative Checkmate" subtitle="">
          <div className="pb-6 mx-auto grid gap-6 grid-cols-1 md:grid-cols-3">
            {/* Chessboard */}
            <div className="md:col-span-2">
              <div className="mb-4">
                <Chessboard
                  initialFen={fen}
                  orientation={orientation}
                  viewOnly={!((phase === GamePhase.TEAM1_SELECTION && playerTeam === 1) || (phase === GamePhase.TEAM2_SELECTION && playerTeam === 2))}
                  onPieceDrop={(sourceSquare, targetSquare) => 
                    handleBoardClick(sourceSquare, targetSquare)
                  }
                  movable={false}
                />
              </div>
                            
              {/* Game status */}
              <div className="bg-white shadow rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p><strong>Game ID:</strong> {gameId}</p>
                    <p><strong>Time Remaining:</strong> {timeRemaining}s</p>
                  </div>
                  <div>
                    <p><strong>Connection:</strong> 
                      <span className={connected ? 'text-green-600' : 'text-red-600'}>
                        {connected ? ' Connected' : ' Disconnected'}
                      </span>
                    </p>
                    <p><strong>Can Move:</strong> <span className={(phase === GamePhase.TEAM1_SELECTION && playerTeam === 1) || (phase === GamePhase.TEAM2_SELECTION && playerTeam === 2) ? 'text-green-600' : 'text-red-600'}>
                      {(phase === GamePhase.TEAM1_SELECTION && playerTeam === 1) || (phase === GamePhase.TEAM2_SELECTION && playerTeam === 2) ? 'Yes' : 'No'}
                    </span></p>
                  </div>
                </div>
              </div>
              
              {/* Player Seats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-white shadow rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2">Team 1</h3>
                  <div className="space-y-2">
                    {/* Team 1 Player 1 */}
                    <div 
                      className={`flex items-center p-2 rounded ${
                        players.t1p1.id === playerId ? 'bg-blue-100' : ''
                      } ${
                        (players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready ? 
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' : 
                          'border border-gray-200'
                      }`}
                      onClick={() => ((players.t1p1.id === null || players.t1p1.id === playerId) && !players.t1p1.ready) && takeSeat('t1p1')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${
                        players.t1p1.ready ? 'bg-green-500' : 'bg-gray-200'
                      }`}></div>
                      <span>{players.t1p1.id || 'Empty Seat'}</span>
                      {players.t1p1.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>
                    
                    {/* Team 1 Player 2 */}
                    <div 
                      className={`flex items-center p-2 rounded ${
                        players.t1p2.id === playerId ? 'bg-blue-100' : ''
                      } ${
                        (players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready ? 
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' : 
                          'border border-gray-200'
                      }`}
                      onClick={() => ((players.t1p2.id === null || players.t1p2.id === playerId) && !players.t1p2.ready) && takeSeat('t1p2')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${
                        players.t1p2.ready ? 'bg-green-500' : 'bg-gray-200'
                      }`}></div>
                      <span>{players.t1p2.id || 'Empty Seat'}</span>
                      {players.t1p2.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>
                  </div>
                </div>
                
                <div className="bg-white shadow rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-2">Team 2</h3>
                  <div className="space-y-2">
                    {/* Team 2 Player 1 */}
                    <div 
                      className={`flex items-center p-2 rounded ${
                        players.t2p1.id === playerId ? 'bg-blue-100' : ''
                      } ${
                        (players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready ? 
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' : 
                          'border border-gray-200'
                      }`}
                      onClick={() => ((players.t2p1.id === null || players.t2p1.id === playerId) && !players.t2p1.ready) && takeSeat('t2p1')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${
                        players.t2p1.ready ? 'bg-green-500' : 'bg-gray-200'
                      }`}></div>
                      <span>{players.t2p1.id || 'Empty Seat'}</span>
                      {players.t2p1.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>
                    
                    {/* Team 2 Player 2 */}
                    <div 
                      className={`flex items-center p-2 rounded ${
                        players.t2p2.id === playerId ? 'bg-blue-100' : ''
                      } ${
                        (players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready ? 
                          'border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-100' : 
                          'border border-gray-200'
                      }`}
                      onClick={() => ((players.t2p2.id === null || players.t2p2.id === playerId) && !players.t2p2.ready) && takeSeat('t2p2')}
                    >
                      <div className={`w-6 h-6 rounded-full mr-2 ${
                        players.t2p2.ready ? 'bg-green-500' : 'bg-gray-200'
                      }`}></div>
                      <span>{players.t2p2.id || 'Empty Seat'}</span>
                      {players.t2p2.id === playerId && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Game Phase Indicator */}
              <div className="bg-white shadow rounded-lg p-4 mb-4">
                <h3 className="font-bold text-lg mb-2">Game Phase</h3>
                <div className="relative h-12 flex items-center">
                  <div className="absolute w-full h-2 bg-gray-200 rounded-full"></div>
                  
                  {/* Phase Markers */}
                  <div className={`relative z-10 h-6 w-6 rounded-full ${phase === GamePhase.TEAM1_SELECTION ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center text-xs text-white font-bold ml-0`}>•</div>
                  <div className="flex-grow h-2"></div>
                  
                  <div className={`relative z-10 h-6 w-6 rounded-full ${phase === GamePhase.TEAM1_COMPUTING ? 'bg-blue-500' : 'bg-gray-300'} flex items-center justify-center text-xs text-white font-bold`}>•</div>
                  <div className="flex-grow h-2"></div>
                  
                  <div className={`relative z-10 h-6 w-6 rounded-full ${phase === GamePhase.TEAM2_COMPUTING ? 'bg-blue-500' : 'bg-gray-300'} flex items-center justify-center text-xs text-white font-bold mr-0`}>•</div>
                  <div className="flex-grow h-2"></div>
                  
                  <div className={`relative z-10 h-6 w-6 rounded-full ${phase === 'team2_selection' ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center text-xs text-white font-bold`}>•</div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span>T1 Select</span>
                  <span>T1 Compute</span>
                  <span>T2 Compute</span>
                  <span>T2 Select</span>
                </div>
              </div>
              
              {/* Control buttons */}
              <div className="grid grid-cols-1 gap-2 mb-4">
                <button 
                  onClick={connected ? disconnectWebSocket : connectWebSocket}
                  className={`p-2 rounded font-bold ${connected ? 
                    'bg-gray-500 hover:bg-gray-600 text-white' : 
                    'bg-green-500 hover:bg-green-600 text-white'}`}
                >
                  {connected ? 'Connected' : 'Connect to localhost:8000'}
                </button>
                
                <button 
                  onClick={readyUp}
                  className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded font-bold"
                  disabled={!connected || !getCurrentPlayerSeat()}
                >
                  Ready Up
                </button>
              </div>
            </div>
            
            {/* Game log panel */}
            <div className="md:col-span-1">
              {/* Game log */}
              <div className="bg-white shadow rounded-lg overflow-hidden mb-4">
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
                    <div key={index} className={`mb-1 p-1 rounded ${
                      entry.type === 'system' ? 'bg-gray-100' :
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