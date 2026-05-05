import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";

interface AvailableGame {
  game_id: string;
  created_at: number;
}

export default function MultipleChoiceChessLobby() {
  const navigate = useNavigate();
  const [gameCode, setGameCode] = useState('');
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/multipleChoiceChess/available');
        if (res.ok) {
          const data = await res.json();
          setAvailableGames(data.games ?? []);
        }
      } catch {
        // silently ignore polling errors
      } finally {
        setIsLoading(false);
      }
    };

    fetchGames();
    const id = setInterval(fetchGames, 5000);
    return () => clearInterval(id);
  }, []);

  const createGame = async () => {
    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/multipleChoiceChess/create', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create game');
      const data = await res.json();
      navigate(`/multiple-choice-chess/${data.game_id}/${data.player_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsJoining(false);
    }
  };

  const joinByCode = useCallback(async (code: string) => {
    const trimmed = code.trim().toLowerCase();
    if (!trimmed) return;
    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/multipleChoiceChess/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_id: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to join game');
      }
      const data = await res.json();
      navigate(`/multiple-choice-chess/${data.game_id}/${data.player_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setIsJoining(false);
    }
  }, [navigate]);

  useEffect(() => {
    const joinCode = new URLSearchParams(window.location.search).get('join');
    if (!joinCode) return;
    setGameCode(joinCode);
    void joinByCode(joinCode);
  }, [joinByCode]);

  const quickMatch = async () => {
    setIsJoining(true);
    setError(null);
    try {
      const res = await fetch('/api/multipleChoiceChess/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'No available games');
      }
      const data = await res.json();
      navigate(`/multiple-choice-chess/${data.game_id}/${data.player_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No available games. Create one instead.');
      setIsJoining(false);
    }
  };

  const formatTimeSince = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <>
      <Navbar />
      <div className="relative z-10 flex min-h-[calc(100vh-theme(spacing.64))] flex-col items-center justify-center p-4">

        {/* Create / Join card */}
        <div className="mb-6 w-full max-w-xl border-4 border-black bg-white p-8">
          <h1 className="mb-6 text-center font-neo text-2xl font-bold uppercase text-black">
            Multiple Choice Chess
          </h1>

          {error && (
            <div className="mb-4 border-2 border-red-500 bg-red-100 p-3 font-neo text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={createGame}
              disabled={isJoining}
              className="w-full border-4 border-black bg-white px-6 py-3 font-neo font-extrabold uppercase tracking-wide hover:bg-black hover:text-white disabled:opacity-50"
            >
              Create New Game
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && joinByCode(gameCode)}
                placeholder="Enter game code"
                className="flex-1 border-2 border-black bg-white px-3 py-2 font-neo focus:ring-2 focus:ring-black"
              />
              <button
                onClick={() => joinByCode(gameCode)}
                disabled={isJoining || !gameCode.trim()}
                className="border-4 border-black bg-white px-4 py-2 font-neo font-extrabold uppercase hover:bg-black hover:text-white disabled:opacity-50"
              >
                Join
              </button>
            </div>

            <button
              onClick={quickMatch}
              disabled={isJoining}
              className="w-full border-4 border-black bg-white px-6 py-3 font-neo font-extrabold uppercase tracking-wide hover:bg-black hover:text-white disabled:opacity-50"
            >
              Quick Match
            </button>
          </div>
        </div>

        {/* Available games */}
        <div className="w-full max-w-xl border-4 border-black bg-white p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-neo text-xl font-bold uppercase text-black">Open Games</h2>
            {isLoading && (
              <div className="flex items-center gap-2 font-neo text-sm text-gray-500">
                <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-black" />
                Refreshing...
              </div>
            )}
          </div>

          {availableGames.length === 0 && !isLoading && (
            <p className="py-6 text-center font-neo text-gray-500">
              No open games. Create one and share the link!
            </p>
          )}

          <div className="space-y-2">
            {availableGames.map((game) => (
              <div
                key={game.game_id}
                className="flex items-center justify-between border-2 border-black p-3 hover:bg-gray-50"
              >
                <div className="font-neo">
                  <span className="font-bold uppercase">{game.game_id}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    · {formatTimeSince(game.created_at)}
                  </span>
                </div>
                <button
                  onClick={() => joinByCode(game.game_id)}
                  disabled={isJoining}
                  className="border-2 border-black bg-white px-3 py-1 font-neo font-extrabold uppercase hover:bg-black hover:text-white disabled:opacity-50"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* About */}
        <div className="mt-6 w-full max-w-xl border-4 border-black bg-white p-8">
          <h2 className="mb-4 font-neo text-xl font-bold uppercase">How it works</h2>
          <ul className="space-y-2 font-neo text-black">
            <li>• On each turn you choose from four engine-generated moves</li>
            <li>• The options are the 1st, 2nd, 4th, and 6th best moves — shown in random order</li>
            <li>• Score: 4 pts for best, 3 for 2nd, 2 for 4th, 1 for 6th</li>
            <li>• You can win the chess game while losing on move quality — and vice versa</li>
          </ul>
        </div>
      </div>
      <Footer />
    </>
  );
}
