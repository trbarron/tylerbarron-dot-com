// Leaderboard Display Component
// Shows top players and user's rank

import { useState, useEffect, useCallback } from "react";
import type { LeaderboardEntry } from "~/utils/chesserGuesser/types";

interface LeaderboardProps {
  currentUsername?: string;
  date?: string;
}

import { useState, useEffect, useCallback } from "react";
import type { LeaderboardEntry } from "~/utils/chesserGuesser/types";
import Skeleton from "~/components/Skeleton";

interface LeaderboardProps {
  currentUsername?: string;
  date?: string;
}

export function Leaderboard({
  currentUsername,
  date
}: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (currentUsername) params.append('username', currentUsername);
      params.append('limit', '50');

      const response = await fetch(`/api/chesserGuesser/leaderboard?${params}&t=${Date.now()}`);
      if (!response.ok) throw new Error('Failed to fetch leaderboard');

      const data = await response.json();
      setLeaderboard(data.leaderboard || []);
      setUserRank(data.userRank || null);
      setTotalPlayers(data.totalPlayers || 0);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError('Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [date, currentUsername]);

  useEffect(() => {
    fetchLeaderboard();
    // Refresh every 60 seconds
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
    <div className="bg-white border-4 border-black">
      {/* Header */}
      <div className="bg-black text-white py-3 px-4 font-neo font-extrabold uppercase tracking-tighter text-lg border-b-4 border-black">
        LEADERBOARD
      </div>

      {/* Content */}
      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 h-8">
                <Skeleton variant="rect" className="w-8 h-full" />
                <Skeleton variant="rect" className="flex-1 h-full" />
                <Skeleton variant="rect" className="w-16 h-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center font-neo font-bold text-red-600 uppercase italic">
            {error}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center font-neo font-bold text-gray-400 uppercase">
            No scores yet today.<br />Be the first!
          </div>
        ) : (
          <>
            {/* Leaderboard Entries */}
            {leaderboard.map((entry, index) => {
              const isCurrentUser = entry.username === currentUsername;
              const medal = getMedalEmoji(entry.rank);

              return (
                <div
                  key={`${entry.username}-${index}`}
                  className={`
                    border-b-2 border-black p-3 font-neo
                    ${isCurrentUser
                      ? 'bg-black text-white'
                      : 'bg-white text-black'
                    }
                  `}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`font-extrabold w-10 flex-shrink-0 text-lg ${entry.rank <= 3 ? 'scale-110' : 'opacity-50'}`}>
                        {medal || `#${entry.rank}`}
                      </span>
                      <span className={`truncate font-bold text-lg tracking-tight ${isCurrentUser ? '' : ''}`}>
                        {entry.username.toUpperCase()}
                        {isCurrentUser && ' (YOU)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`font-black text-xl min-w-16 text-right ${isCurrentUser ? 'text-white' : 'text-black'}`} title="Total Difference">
                        {entry.score}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Footer Summary */}
            <div className="p-3 text-center font-neo font-black text-sm uppercase bg-gray-100 border-t-2 border-black">
              {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'} competing today
            </div>
          </>
        )}
      </div>
    </div>
  );
}
