import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";

interface AvailableGame {
  game_id: string;
  created_at: number;
}

export default function MultipleChoiceChessLobby() {
  const navigate = useNavigate();
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchGames = async () => {
      try {
        setIsLoading(true);
        const res = await fetch('/api/multipleChoiceChess/available');
        if (!cancelled && res.ok) {
          const data = await res.json();
          setAvailableGames(data.games ?? []);
        }
      } catch {
        // silently ignore polling errors
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (id !== null) return;
      fetchGames();
      id = setInterval(fetchGames, 5000);
    };
    const stop = () => {
      if (id !== null) {
        clearInterval(id);
        id = null;
      }
    };

    if (!document.hidden) start();

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
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
    void joinByCode(joinCode);
  }, [joinByCode]);

  const formatTimeSince = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  return (
    <>
      <Navbar />
      <div className="relative z-10 flex min-h-[calc(100vh-theme(spacing.64))] flex-col items-center justify-center p-4">

        {/* Hero card */}
        <div className="mb-6 w-full max-w-xl border-4 border-black bg-white">
          <div className="border-b-4 border-black bg-black px-8 py-6 text-white">
            <h1 className="font-neo text-3xl font-extrabold uppercase leading-none tracking-tight md:text-4xl">
              Multiple<br/>Choice Chess
            </h1>
          </div>

          <div className="p-8">
            <p className="mb-3 font-neo text-black">
              Pick from four engine moves each turn — the 1st, 2nd, 4th, and 6th best, shuffled. No time controls.
            </p>

            <details className="mb-6 group">
              <summary className="cursor-pointer font-neo text-sm font-bold uppercase tracking-wide text-gray-600 hover:text-black">
                <span className="group-open:hidden">How scoring works ↓</span>
                <span className="hidden group-open:inline">Hide ↑</span>
              </summary>
              <div className="mt-3 space-y-2 border-2 border-black bg-gray-50 p-3 font-neo text-sm text-black">
                <p>Each turn you see four moves picked by Stockfish, shuffled so you don't know which is best.</p>
                <ul className="ml-5 list-disc space-y-1 text-gray-700">
                  <li><span className="font-bold text-black">#1</span> — best move (4 points)</li>
                  <li><span className="font-bold text-black">#2</span> — second best (3 points)</li>
                  <li><span className="font-bold text-black">#4</span> — fourth best (2 points)</li>
                  <li><span className="font-bold text-black">#6</span> — sixth best (1 point)</li>
                </ul>
                <p className="text-gray-700">Higher accuracy means you picked the engine's top moves more often. Beat your opponent on the board <em>and</em> in the breakdown.</p>
              </div>
            </details>

            {error && (
              <div className="mb-4 border-2 border-red-500 bg-red-100 p-3 font-neo text-sm text-red-800">
                {error}
              </div>
            )}

            <button
              onClick={createGame}
              disabled={isJoining}
              className="w-full border-4 border-black bg-black px-6 py-4 font-neo text-lg font-extrabold uppercase tracking-wide text-white hover:bg-white hover:text-black disabled:opacity-50"
            >
              {isJoining ? 'Starting…' : 'Create New Game'}
            </button>
          </div>
        </div>

        {/* Available games */}
        <div className="w-full max-w-xl border-4 border-black bg-white">
          <div className="flex items-center justify-between border-b-2 border-black px-6 py-3">
            <div className="flex items-baseline gap-3">
              <h2 className="font-neo text-sm font-bold uppercase tracking-wider text-black">Open Games</h2>
              <span className="font-neo text-xs text-gray-500">
                {availableGames.length} waiting
              </span>
            </div>
            {isLoading && (
              <div className="h-3 w-3 animate-spin rounded-full border-b-2 border-black" aria-label="Refreshing" />
            )}
          </div>

          <div className="p-4">
            {availableGames.length === 0 && (
              <p className="py-8 text-center font-neo text-sm text-gray-500">
                No open games yet
              </p>
            )}

            <div className="space-y-2">
              {availableGames.map((game) => (
                <button
                  key={game.game_id}
                  onClick={() => joinByCode(game.game_id)}
                  disabled={isJoining}
                  className="group flex w-full items-center justify-between border-2 border-black p-3 text-left hover:bg-black hover:text-white disabled:opacity-50"
                >
                  <div className="font-neo">
                    <span className="font-bold uppercase tracking-wide">{game.game_id}</span>
                    <span className="ml-2 text-sm text-gray-500 group-hover:text-white/60">
                      {formatTimeSince(game.created_at)}
                    </span>
                  </div>
                  <span className="font-neo text-sm font-extrabold uppercase tracking-wide">
                    Join →
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
