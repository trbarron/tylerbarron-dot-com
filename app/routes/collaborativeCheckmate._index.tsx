import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
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
      <div className="min-h-[calc(100vh-theme(spacing.64))] flex flex-col items-center justify-center bg-white  p-4">
        <div className="bg-white  border-4 border-black  p-8 w-full max-w-xl mb-8">
          <h1 className="text-2xl mb-6 text-center text-black  font-neo font-bold uppercase">
            Collaborative Checkmate
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="playerId" className="block text-sm font-medium text-black  font-neo">
                Username
              </label>
              <input
                type="text"
                id="playerId"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="mt-1 block w-full border-2 border-black  bg-white  text-black  px-3 py-2 focus:ring-2 focus:ring-accent font-neo"
                placeholder="Enter your username"
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="gameCode" className="block text-sm font-medium text-black  font-neo">
                Game Code
              </label>
              <input
                type="text"
                id="gameCode"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                className="mt-1 block w-full border-2 border-black  bg-white  text-black  px-3 py-2 focus:ring-2 focus:ring-accent font-neo"
                placeholder="Enter an existing code to join, or create a new one"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="h-4 w-4 border-2 border-black  focus:ring-accent"
              />
              <label htmlFor="isPrivate" className="ml-2 block text-sm text-black  font-neo">
                Private game
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-white  text-black  border-4 border-black  px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-black  hover:text-white  font-neo"
            >
              Create/Join Game
            </button>
          </form>
        </div>

        {/* Available Games Section */}
        <div className="bg-white  border-4 border-black  p-8 w-full max-w-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl text-center text-black  font-neo font-bold uppercase">Available Games</h2>
            {isLoading && (
              <div className="inline-flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-accent mr-2"></div>
                <span className="text-sm text-black  font-neo">Refreshing...</span>
              </div>
            )}
          </div>
          
          {error && (
            <div className="bg-red-100  border-2 border-red-500  text-red-800  p-4 mb-4 font-neo">
              {error}
            </div>
          )}
          
          {availableGames.length === 0 && !isLoading && (
            <div className="text-gray-500  text-center py-8 font-neo">
              No available games found. Create a new game to start playing!
            </div>
          )}
          
          {availableGames.length > 0 && (
            <div className="space-y-3">
              {availableGames.map((game) => (
                <div 
                  key={game.game_id} 
                  className="border-2 border-black  p-4 hover:bg-gray-100  cursor-pointer transition-colors"
                  onClick={() => joinGame(game.game_id)}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-black  font-neo">Game: {game.game_id}</h3>
                      <p className="text-sm text-gray-600  font-neo">
                        Players: {game.occupied_seats}/4 • Created: {formatTimeSince(game.created_time)}
                      </p>
                    </div>
                    <button 
                      className="bg-white  text-black  border-2 border-black  px-3 py-1 font-extrabold uppercase tracking-wide hover:bg-accent  hover:text-white font-neo"
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
        <div className="bg-white  border-4 border-black  p-8 mt-8 w-full max-w-xl">
          <div className="flex justify-center items-center mb-6">
            <h2 className="text-2xl text-center text-black  font-neo font-bold uppercase">
              What is Collaborative Checkmate?
            </h2>
          </div>
          
          <p className="text-black  mb-4 font-neo">
            A fast-paced 2v2 chess variant where teammates work together to outplay their opponents
          </p>
          
          <div className="mb-6">
            <h3 className="mb-2 text-black  font-neo font-bold uppercase border-b-2 border-accent pb-2">How it works:</h3>
            <ul className="space-y-2">
              <li className="text-black  font-neo">
              • Teams of two players compete against each other
              </li>
              <li className="text-black  font-neo">
              • Each teammate independently selects a move within 15 seconds
              </li>
              <li className="text-black  font-neo">
              • The chess engine automatically plays the stronger of the two suggested moves
              </li>
              <li className="text-black  font-neo">
              • This passes to the other team, which then has 15 seconds to select a response
              </li>
            </ul>
          </div>
          
          <p className="text-black  mb-4 font-neo">
            It's a blend of individual chess skill and teamwork that rewards quick thinking and collaboration. 
            Even when teammates have different skill levels, the format ensures your team always makes betterish moves
          </p>
          </div>
      </div>
      <Footer />
    </>
  );
}