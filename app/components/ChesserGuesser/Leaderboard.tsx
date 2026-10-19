// Leaderboard Display Component
// Shows top players and user's rank

import { useState, useEffect, useCallback } from 'react';
import type { LeaderboardEntry } from '~/utils/chesserGuesser/types';
import Skeleton from '~/components/Skeleton';

interface LeaderboardProps {
  currentUsername?: string;
  date?: string;
}

export function Leaderboard({ currentUsername, date }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (currentUsername) params.append('username', currentUsername);
      params.append('limit', '50');

      const response = await fetch(`/api/chesserGuesser/leaderboard?${params}&t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setTotalPlayers(data.totalPlayers || 0);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setLeaderboard([]);
      setTotalPlayers(0);
    } finally {
      setIsLoading(false);
    }
  }, [date, currentUsername]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  const getMedalEmoji = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  return (
    <div className="border-4 border-black bg-white">
      <div className="font-neo border-b-4 border-black bg-black px-4 py-3 text-lg font-extrabold tracking-tighter text-white uppercase">
        LEADERBOARD
      </div>
      <div className="font-neo border-b-2 border-black px-4 py-2 text-xs text-gray-700">
        Score: total gap from Stockfish’s evals, in centipawns. Lowest wins.
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex h-8 items-center gap-4">
                <Skeleton variant="rect" className="h-full w-8" />
                <Skeleton variant="rect" className="h-full flex-1" />
                <Skeleton variant="rect" className="h-full w-16" />
              </div>
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="font-neo p-8 text-center font-bold text-black uppercase opacity-50">
            No scores yet today.
            <br />
            Be the first!
          </div>
        ) : (
          <>
            {leaderboard.map((entry, index) => {
              const isCurrentUser = entry.username === currentUsername;
              const medal = getMedalEmoji(entry.rank);

              return (
                <div
                  key={`${entry.username}-${index}`}
                  className={`font-neo border-b-2 border-black p-3 ${
                    isCurrentUser ? 'border-l-4 border-l-black bg-gray-100 text-black' : 'bg-white text-black'
                  } `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span
                        className={`w-10 flex-shrink-0 text-lg font-extrabold ${entry.rank <= 3 ? 'scale-110' : 'opacity-50'}`}
                      >
                        {medal || `#${entry.rank}`}
                      </span>
                      <span className="truncate text-lg font-bold tracking-tight">
                        {entry.username.toUpperCase()}
                        {isCurrentUser && ' (YOU)'}
                      </span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <span className="min-w-16 text-right text-xl font-black text-black" title="Total Difference">
                        {entry.score}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="font-neo border-t-2 border-black bg-gray-100 p-3 text-center text-sm font-black uppercase">
              {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'} competing today
            </div>
          </>
        )}
      </div>
    </div>
  );
}
