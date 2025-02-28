import { useState } from "react";
import { useNavigate } from "@remix-run/react";
import Footer from "~/components/Footer";
import { Navbar } from "~/components/Navbar";

export default function CollaborativeCheckmate() {
  const [gameCode, setGameCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!gameCode || !playerId) {
      alert("Please fill in both fields");
      return;
    }

    // Navigate to the game page using the provided game code and generated player ID
    navigate(`/collaborativeCheckmate/${gameCode}/${playerId}`, {
      state: { playerId }
    });
  };

  return (
    <>
      <Navbar />
      <div className="h-[calc(100vh-theme(spacing.64))] flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md w-96">
          <h1 className="text-2xl font-bold mb-6 text-center">
            Collaborative Checkmate
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="gameCode" className="block text-sm font-medium text-gray-700">
                Game Code (it can be anything)
              </label>
              <input
                type="text"
                id="gameCode"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter game code"
              />
            </div>

            <div>
              <label htmlFor="playerId" className="block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                type="text"
                id="playerId"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                placeholder="Enter your username"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Join Game
            </button>
          </form>
        </div>
      </div>
      <Footer />
    </>
  );
}
