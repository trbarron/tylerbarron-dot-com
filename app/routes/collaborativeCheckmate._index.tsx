import { useState } from 'react';
import { useNavigate } from 'react-router';
import Footer from '~/components/Footer';
import { Navbar } from '~/components/Navbar';
import { usePolling } from '~/hooks/usePolling';
import { GAME_ID_RE, PLAYER_ID_RE } from '~/utils/collaborativeCheckmate/types';
import { buildMeta } from '~/utils/seo';

export function meta() {
  return buildMeta({
    title: 'Collaborative Checkmate',
    description: 'Real-time team chess: pair up with a partner and coordinate moves against another duo.',
    path: '/collaborative-checkmate',
  });
}

interface Game {
  game_id: string;
  occupied_seats: number;
  created_time: number;
}

export default function CollaborativeCheckmate() {
  const [gameCode, setGameCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [availableGames, setAvailableGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Paused while the tab is hidden.
  usePolling(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/collaborativeCheckmate/available');
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      const data = await response.json();
      setAvailableGames(data.games || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch available games:', err);
      setError('Could not load available games. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, 5000);

  // Format the time difference
  const formatTimeSince = (timestampMs: number) => {
    const diffSeconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));

    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`;
    } else if (diffSeconds < 3600) {
      return `${Math.floor(diffSeconds / 60)} minutes ago`;
    } else {
      return `${Math.floor(diffSeconds / 3600)} hours ago`;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const code = gameCode.trim().toLowerCase();
    if (!GAME_ID_RE.test(code) || !PLAYER_ID_RE.test(playerId.trim())) {
      setError('Use a game code and username of letters, numbers, - or _ (usernames up to 24 characters).');
      return;
    }

    navigate(`/collaborative-checkmate/${code}/${playerId.trim()}`, { state: { isPrivate } });
  };

  const joinGame = (gameId: string) => {
    if (!PLAYER_ID_RE.test(playerId.trim())) {
      setError('Enter a username first: letters, numbers, - or _, up to 24 characters.');
      return;
    }

    navigate(`/collaborative-checkmate/${gameId}/${playerId.trim()}`);
  };

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-grow flex-col items-center justify-center p-4">
        <div className="mb-8 w-full max-w-xl border-4 border-black bg-white p-8">
          <h1 className="font-neo mb-6 text-center text-2xl font-bold text-black uppercase">Collaborative Checkmate</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="playerId" className="font-neo block text-sm font-medium text-black">
                Username
              </label>
              <input
                type="text"
                id="playerId"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="focus:ring-accent font-neo mt-1 block w-full border-2 border-black bg-white px-3 py-2 text-black focus:ring-2"
                placeholder="Enter your username"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="gameCode" className="font-neo block text-sm font-medium text-black">
                Game Code
              </label>
              <input
                type="text"
                id="gameCode"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                className="focus:ring-accent font-neo mt-1 block w-full border-2 border-black bg-white px-3 py-2 text-black focus:ring-2"
                placeholder="Enter an existing code to join, or create a new one"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="focus:ring-accent h-4 w-4 border-2 border-black"
              />
              <label htmlFor="isPrivate" className="font-neo ml-2 block text-sm text-black">
                Private game
              </label>
            </div>

            <button
              type="submit"
              className="font-neo w-full border-4 border-black bg-white px-6 py-3 font-extrabold tracking-wide text-black uppercase hover:bg-black hover:text-white"
            >
              Create/Join Game
            </button>
          </form>
        </div>

        {/* Available Games Section */}
        <div className="w-full max-w-xl border-4 border-black bg-white p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-neo text-center text-xl font-bold text-black uppercase">Available Games</h2>
            {isLoading && (
              <div className="inline-flex items-center">
                <div className="border-accent mr-2 h-5 w-5 animate-spin rounded-full border-b-2"></div>
                <span className="font-neo text-sm text-black">Refreshing...</span>
              </div>
            )}
          </div>

          {error && <div className="font-neo mb-4 border-2 border-red-500 bg-red-100 p-4 text-red-800">{error}</div>}

          {availableGames.length === 0 && !isLoading && (
            <div className="font-neo py-8 text-center text-gray-500">
              No available games found. Create a new game to start playing!
            </div>
          )}

          {availableGames.length > 0 && (
            <div className="space-y-3">
              {availableGames.map((game) => (
                <div
                  key={game.game_id}
                  className="cursor-pointer border-2 border-black p-4 transition-colors hover:bg-gray-100"
                  onClick={() => joinGame(game.game_id)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-neo font-medium text-black">Game: {game.game_id}</h3>
                      <p className="font-neo text-sm text-gray-600">
                        Players: {game.occupied_seats}/4 • Created: {formatTimeSince(game.created_time)}
                      </p>
                    </div>
                    <button
                      className="hover:bg-accent font-neo border-2 border-black bg-white px-3 py-1 font-extrabold tracking-wide text-black uppercase hover:text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        joinGame(game.game_id);
                      }}
                    >
                      Join
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Game Description Section */}
        <div className="mt-8 w-full max-w-xl border-4 border-black bg-white p-8">
          <div className="mb-6 flex items-center justify-center">
            <h2 className="font-neo text-center text-2xl font-bold text-black uppercase">
              What is Collaborative Checkmate?
            </h2>
          </div>

          <p className="font-neo mb-4 text-black">
            A fast-paced 2v2 chess variant where teammates work together to outplay their opponents
          </p>

          <div className="mb-6">
            <h3 className="font-neo border-accent mb-2 border-b-2 pb-2 font-bold text-black uppercase">
              How it works:
            </h3>
            <ul className="space-y-2">
              <li className="font-neo text-black">• Teams of two players compete against each other</li>
              <li className="font-neo text-black">• Each teammate independently selects a move within 15 seconds</li>
              <li className="font-neo text-black">
                • The chess engine automatically plays the stronger of the two suggested moves
              </li>
              <li className="font-neo text-black">
                • This passes to the other team, which then has 15 seconds to select a response
              </li>
            </ul>
          </div>

          <p className="font-neo mb-4 text-black">
            It's a blend of individual chess skill and teamwork that rewards quick thinking and collaboration. Even when
            teammates have different skill levels, the format ensures your team always makes betterish moves
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
