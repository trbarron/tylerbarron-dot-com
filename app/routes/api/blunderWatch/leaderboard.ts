// GET /api/blunderWatch/leaderboard?date=YYYY-MM-DD&limit=50&username=player123
//
// Higher score = better rank. ZREVRANGE returns members in descending score order.

import type { LoaderFunctionArgs } from 'react-router';
import { getRedisClient } from '~/utils/redis.server';
import type { LeaderboardEntry } from '~/utils/blunderWatch/types';

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') || getTodayDateString();
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const usernameParam = url.searchParams.get('username');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'Invalid date format.' }, { status: 400 });
    }

    const redis = getRedisClient();
    const leaderboardKey = `blunderWatch:leaderboard:${date}`;

    // ZREVRANGE: highest score first (best rank first)
    const topUsers = await redis.zrevrange(leaderboardKey, 0, limit - 1, 'WITHSCORES');

    const leaderboard: LeaderboardEntry[] = [];
    for (let i = 0; i < topUsers.length; i += 2) {
      const username = topUsers[i];
      const summaryKey = `blunderWatch:summary:${date}:${username}`;
      const summaryRaw = await redis.get(summaryKey);
      const summary = summaryRaw ? JSON.parse(summaryRaw) : null;

      leaderboard.push({
        rank: Math.floor(i / 2) + 1,
        username,
        score: summary?.score ?? 0,
        blundersCaught: summary?.blundersCaught ?? 0,
        falsePositives: summary?.falsePositives ?? 0,
        timestamp: summary?.timestamp ?? 0,
      });
    }

    // If username provided and not in the returned slice, fetch their rank separately
    let userRank: LeaderboardEntry | null = null;
    if (usernameParam) {
      const rankRaw = await redis.zrevrank(leaderboardKey, usernameParam);
      if (rankRaw !== null && rankRaw >= limit) {
        const summaryKey = `blunderWatch:summary:${date}:${usernameParam}`;
        const summaryRaw = await redis.get(summaryKey);
        const summary = summaryRaw ? JSON.parse(summaryRaw) : null;
        userRank = {
          rank: rankRaw + 1,
          username: usernameParam,
          score: summary?.score ?? 0,
          blundersCaught: summary?.blundersCaught ?? 0,
          falsePositives: summary?.falsePositives ?? 0,
          timestamp: summary?.timestamp ?? 0,
        };
      }
    }

    const totalPlayers = await redis.zcard(leaderboardKey);

    return Response.json(
      { leaderboard, userRank, totalPlayers, date },
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error) {
    console.error('BlunderWatch leaderboard API error:', error);
    return Response.json({ error: 'Failed to fetch leaderboard.' }, { status: 500 });
  }
}
