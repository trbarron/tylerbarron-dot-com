// Daily leaderboard for Blunder Watch — adapted from ChesserGuesser/Leaderboard.tsx

import { useState, useEffect, useCallback } from 'react';
import type { LeaderboardEntry } from '~/utils/blunderWatch/types';
import Skeleton from '~/components/Skeleton';

interface LeaderboardProps {
  currentUsername?: string;
  date?: string;
}

function medalEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

export function Leaderboard({ currentUsername, date }: LeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({ limit: '50', t: String(Date.now()) });
      if (date) params.append('date', date);
      if (currentUsername) params.append('username', currentUsername);

      const res = await fetch(`/api/blunderWatch/leaderboard?${params}`);
      if (!res.ok) throw new Error('Failed to fetch leaderboard');

      const data = await res.json();
      setLeaderboard(data.leaderboard ?? []);
      setUserRank(data.userRank ?? null);
      setTotalPlayers(data.totalPlayers ?? 0);
    } catch {
      setError('Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [date, currentUsername]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return (
    <div className="bg-white border-4 border-black">
      <div className="bg-black text-white py-3 px-4 font-neo font-extrabold uppercase tracking-tighter text-lg border-b-4 border-black text-center md:text-left">
        TODAY'S LEADERBOARD
      </div>

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
          <div className="p-8 text-center font-neo font-bold text-black uppercase">
            {error}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center font-neo font-bold text-black opacity-50 uppercase">
            No scores yet today.<br />Be the first!
          </div>
        ) : (
          <>
            {leaderboard.map((entry, i) => {
              const isMe = entry.username === currentUsername;
              const medal = medalEmoji(entry.rank);
              return (
                <div
                  key={`${entry.username}-${i}`}
                  className={`
                    border-b-2 border-black p-3 font-neo
                    ${isMe
                      ? 'bg-gray-100 border-l-4 border-l-black text-black'
                      : 'bg-white text-black'
                    }
                  `}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`font-extrabold w-10 flex-shrink-0 text-lg ${entry.rank <= 3 ? 'scale-110' : 'opacity-50'}`}>
                        {medal || `#${entry.rank}`}
                      </span>
                      <span className="truncate font-bold text-lg tracking-tight">
                        {entry.username.toUpperCase()}
                        {isMe && ' (YOU)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-right">
                      <div className="flex flex-col items-end pr-2">
                        <span className="text-[10px] font-bold text-black opacity-60" title="Blunders caught">
                          {entry.blundersCaught}✓
                        </span>
                        {entry.falsePositives > 0 && (
                          <span className="text-[10px] font-bold text-black opacity-50" title="False positives">
                            {entry.falsePositives}✗
                          </span>
                        )}
                      </div>
                      <span className="font-black text-xl min-w-16 text-right text-black">
                        {entry.score}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {userRank && (
              <>
                <div className="border-b-4 border-black" />
                <div className="bg-gray-100 border-l-4 border-l-black border-b-2 border-black p-3 font-neo text-xs">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold w-10 text-lg text-black opacity-50">#{userRank.rank}</span>
                      <span className="font-bold text-lg tracking-tight text-black">
                        {userRank.username.toUpperCase()} (YOU)
                      </span>
                    </div>
                    <span className="font-black text-xl min-w-16 text-right text-black">{userRank.score}</span>
                  </div>
                </div>
              </>
            )}

            <div className="p-3 text-center font-neo font-black text-sm uppercase bg-gray-100 border-t-2 border-black">
              {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'} competing today
            </div>
          </>
        )}
      </div>
    </div>
  );
}
