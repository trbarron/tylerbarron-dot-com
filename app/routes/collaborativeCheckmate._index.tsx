import { useState, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import Footer from "~/components/Footer";
import { Navbar } from "~/components/Navbar";

export default function CollaborativeCheckmate() {
  const [gameCode, setGameCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [availableGames, setAvailableGames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("https://collaborative-checkmate-server.fly.dev/api/games/available");
        
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        
        const data = await response.json();
        setAvailableGames(data.games || []);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch available games:", err);
        setError("Could not load available games. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch immediately and then every 15 seconds
    fetchGames();
    const intervalId = setInterval(fetchGames, 15000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Format the time difference
  const formatTimeSince = (timestamp) => {
    const now = Date.now() / 1000;
    const diffSeconds = Math.floor(now - timestamp);
    
    if (diffSeconds < 60) {
      return `${diffSeconds} seconds ago`;
    } else if (diffSeconds < 3600) {
      return `${Math.floor(diffSeconds / 60)} minutes ago`;
    } else {
      return `${Math.floor(diffSeconds / 3600)} hours ago`;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!gameCode || !playerId) {
      alert("Please fill in both game code and username");
      return;
    }

    navigate(`/collaborativeCheckmate/${gameCode.toLowerCase()}/${playerId}`, {
      state: { playerId, isPrivate }
    });
  };

  const joinGame = (gameId) => {
    if (!playerId) {
      alert("Please enter a username first");
      return;
    }
    
    navigate(`/collaborativeCheckmate/${gameId}/${playerId}`, {
      state: { playerId }
    });
  };

  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-theme(spacing.64))] flex flex-col items-center justify-center bg-gray-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-xl mb-8">
          <h1 className="text-2xl mb-6 text-center">
            Collaborative Checkmate
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="playerId" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                id="playerId"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-gray-500 focus:ring-gray-500"
                placeholder="Enter your username"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="gameCode" className="block text-sm font-medium text-gray-700">
                Game Code
              </label>
              <input
                type="text"
                id="gameCode"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-gray-500"
                placeholder="Enter an existing code to join, or create a new one"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-gray-500 border-gray-300 rounded"
              />
              <label htmlFor="isPrivate" className="ml-2 block text-sm text-gray-700">
                Private game
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Create/Join Game
            </button>
          </form>
        </div>

        {/* Available Games Section */}
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl text-center">Available Games</h2>
            {isLoading && (
              <div className="inline-flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
                <span className="text-sm text-gray-600">Refreshing...</span>
              </div>
            )}
          </div>
          
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-4">
              {error}
            </div>
          )}
          
          {availableGames.length === 0 && !isLoading && (
            <div className="text-gray-500 text-center py-8">
              No available games found. Create a new game to start playing!
            </div>
          )}
          
          {availableGames.length > 0 && (
            <div className="space-y-3">
              {availableGames.map((game) => (
                <div 
                  key={game.game_id} 
                  className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => joinGame(game.game_id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">Game: {game.game_id}</h3>
                      <p className="text-sm text-gray-600">
                        Players: {game.occupied_seats}/4 • Created: {formatTimeSince(game.created_time)}
                      </p>
                    </div>
                    <button 
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
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
      </div>
      <Footer />
    </>
  );
}