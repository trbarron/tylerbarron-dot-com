// Leaderboard Display Component
// Shows top players and user's rank

import { useState, useEffect } from "react";
import type { LeaderboardEntry } from "~/utils/chesserGuesser/types";

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

  useEffect(() => {
    fetchLeaderboard();
    // Refresh every 60 seconds
    const interval = setInterval(fetchLeaderboard, 60000);
    return () => clearInterval(interval);
  }, [date, currentUsername]);

  const fetchLeaderboard = async () => {
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
  };

  const getMedalEmoji = (rank: number): string => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  return (
    <div className="bg-white  border-4 border-black ">
      {/* Header */}
      <div className="border-b-2 border-accent py-2 inline-flex items-center justify-center text-sm md:text-md font-neo font-bold uppercase text-black  w-full">
        Leaderboard
      </div>

      {/* Content */}
      <div>
        <div className="max-h-[500px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center font-neo text-sm text-gray-600 ">
              Loading...
            </div>
          ) : error ? (
            <div className="p-4 text-center font-neo text-sm text-red-600 ">
              {error}
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-4 text-center font-neo text-sm text-gray-600 ">
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
                      border-b border-black  p-2 font-neo text-xs
                      ${isCurrentUser
                        ? 'bg-yellow-100 '
                        : 'bg-white '
                      }
                    `}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={`font-bold w-8 flex-shrink-0 ${entry.rank <= 3 ? 'text-md' : ''}`}>
                          {medal || `#${entry.rank}`}
                        </span>
                        <span className={`truncate ${isCurrentUser ? 'font-bold' : ''} text-black `}>
                          {entry.username}
                          {isCurrentUser && ' (You)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">

                        <span className={`font-bold min-w-12 text-right ${isCurrentUser ? 'text-black ' : 'text-accent'}`} title="Total Difference">
                          {entry.score}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* User Rank (if outside top 50) */}
              {userRank && (
                <>
                  <div className="border-b-2 border-black "></div>
                  <div className="bg-yellow-100  border-b border-black  p-2 font-neo text-xs">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-bold w-8">#{userRank.rank}</span>
                        <span className="font-bold text-black ">
                          {userRank.username} (You)
                        </span>
                      </div>
                      <div className="flex items-center gap-3">

                        <span className="font-bold text-black  min-w-12 text-right" title="Total Difference">
                          {userRank.score}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Footer */}
              <div className="p-2 text-center font-neo text-xs text-gray-600  bg-gray-50 ">
                {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'} today
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
