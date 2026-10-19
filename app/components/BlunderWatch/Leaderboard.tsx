// Daily leaderboard for Blunder Watch — adapted from ChesserGuesser/Leaderboard.tsx

import { useState, useEffect, useCallback } from 'react';
import type { LeaderboardEntry } from '~/utils/blunderWatch/types';
import Skeleton from '~/components/Skeleton';
import Panel from '~/components/Panel';

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
    <Panel title="Today’s Leaderboard" dark>
      <div className="font-neo border-b-2 border-black px-4 py-2 text-xs text-gray-700">
        ✓ blunders caught · ✗ false alarms
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
        ) : error ? (
          <div className="font-neo p-8 text-center font-bold text-black uppercase">{error}</div>
        ) : leaderboard.length === 0 ? (
          <div className="font-neo p-8 text-center font-bold text-black uppercase opacity-50">
            No scores yet today.
            <br />
            Be the first!
          </div>
        ) : (
          <>
            {leaderboard.map((entry, i) => {
              const isMe = entry.username === currentUsername;
              const medal = medalEmoji(entry.rank);
              return (
                <div
                  key={`${entry.username}-${i}`}
                  className={`font-neo border-b-2 border-black p-3 ${
                    isMe ? 'border-l-4 border-l-black bg-gray-100 text-black' : 'bg-white text-black'
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
                        {isMe && ' (YOU)'}
                      </span>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3 text-right">
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
                      <span className="min-w-16 text-right text-xl font-black text-black">{entry.score}</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {userRank && (
              <>
                <div className="border-b-4 border-black" />
                <div className="font-neo border-b-2 border-l-4 border-black border-l-black bg-gray-100 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-10 text-lg font-extrabold text-black opacity-50">#{userRank.rank}</span>
                      <span className="text-lg font-bold tracking-tight text-black">
                        {userRank.username.toUpperCase()} (YOU)
                      </span>
                    </div>
                    <span className="min-w-16 text-right text-xl font-black text-black">{userRank.score}</span>
                  </div>
                </div>
              </>
            )}

            <div className="font-neo border-t-2 border-black bg-gray-100 p-3 text-center text-sm font-black uppercase">
              {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'} competing today
            </div>
          </>
        )}
      </div>
    </Panel>
  );
}
