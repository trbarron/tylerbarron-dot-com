// Daily leaderboard for Blunder Watch — adapted from ChesserGuesser/Leaderboard.tsx

import { useState, useEffect, useCallback } from 'react';
import type { LeaderboardEntry } from '~/utils/blunderWatch/types';

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
      if (leaderboard.length === 0) setIsLoading(true);
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
  }, [date, currentUsername, leaderboard.length]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 60_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return (
    <div className="bg-white border-4 border-black">
      <div className="border-b-2 border-black py-2 text-center">
        <span className="font-neo font-bold text-black uppercase text-sm">Today's Leaderboard</span>
      </div>

      <div className="max-h-[500px] overflow-y-auto">
        {isLoading ? (
          <p className="p-4 text-center font-neo text-sm text-gray-500">Loading…</p>
        ) : error ? (
          <p className="p-4 text-center font-neo text-sm text-red-500">{error}</p>
        ) : leaderboard.length === 0 ? (
          <p className="p-4 text-center font-neo text-sm text-gray-500">
            No scores yet today. Be the first!
          </p>
        ) : (
          <>
            {leaderboard.map((entry, i) => {
              const isMe = entry.username === currentUsername;
              const medal = medalEmoji(entry.rank);
              return (
                <div
                  key={`${entry.username}-${i}`}
                  className={`border-b border-black p-2 font-neo text-xs ${isMe ? 'bg-yellow-100' : 'bg-white'}`}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="font-bold w-8 flex-shrink-0">{medal || `#${entry.rank}`}</span>
                      <span className={`truncate text-black ${isMe ? 'font-bold' : ''}`}>
                        {entry.username}{isMe ? ' (You)' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-right">
                      <span className="text-gray-400 text-xs" title="Blunders caught">
                        {entry.blundersCaught}✓
                      </span>
                      {entry.falsePositives > 0 && (
                        <span className="text-red-500 text-xs" title="False positives">
                          {entry.falsePositives}✗
                        </span>
                      )}
                      <span className={`font-bold min-w-[2.5rem] ${isMe ? 'text-black' : 'text-black'}`}>
                        {entry.score}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {userRank && (
              <>
                <div className="border-b-2 border-black" />
                <div className="bg-yellow-100 border-b border-black p-2 font-neo text-xs">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-bold w-8">#{userRank.rank}</span>
                      <span className="font-bold text-black">{userRank.username} (You)</span>
                    </div>
                    <span className="font-bold text-black">{userRank.score}</span>
                  </div>
                </div>
              </>
            )}

            <div className="p-2 text-center font-neo text-xs text-gray-500 bg-gray-50">
              {totalPlayers} {totalPlayers === 1 ? 'player' : 'players'} today
            </div>
          </>
        )}
      </div>
    </div>
  );
}
