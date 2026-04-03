// API Route: Get daily leaderboard
// GET /api/chesserGuesser/leaderboard?date=YYYY-MM-DD&limit=50

import type { LoaderFunctionArgs } from "react-router";
import { getRedisClient } from "~/utils/redis.server";
import { getTodayDateString } from "~/utils/chesserGuesser/seededRandom";
import type { LeaderboardEntry } from "~/utils/chesserGuesser/types";
import { rateLimitMiddleware } from "~/utils/chesserGuesser/rateLimit.server";

/**
 * Get leaderboard for a specific date
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const limitParam = url.searchParams.get('limit');
    const usernameParam = url.searchParams.get('username');

    const dateString = dateParam || getTodayDateString();
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return Response.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return Response.json(
        { error: 'Invalid limit. Must be 1-100.' },
        { status: 400 }
      );
    }

    // Check rate limit
    const rateLimited = await rateLimitMiddleware(request, 'leaderboard');
    if (rateLimited) {
      return Response.json(rateLimited.error, {
        status: 429,
        headers: rateLimited.headers,
      });
    }

    const redis = getRedisClient();
    const leaderboardKey = `chesserGuesser:leaderboard:${dateString}`;

    // Get top N users from sorted set (ascending by score - lowest diff is best)
    const topUsers = await redis.zrange(
      leaderboardKey,
      0,
      limit - 1,
      'WITHSCORES'
    );

    // Parse usernames and scores from ZRANGE result
    const usernames: string[] = [];
    const scores: number[] = [];
    for (let i = 0; i < topUsers.length; i += 2) {
      usernames.push(topUsers[i]);
      scores.push(parseInt(topUsers[i + 1], 10));
    }

    // Batch-fetch completed counts and summaries in two round trips instead of 2N
    const completedKeys = usernames.map(u => `chesserGuesser:completed:${dateString}:${u}`);
    const summaryKeys = usernames.map(u => `chesserGuesser:summary:${dateString}:${u}`);
    const [completedResults, summaryResults] = await Promise.all([
      completedKeys.length > 0 ? redis.mget(...completedKeys) : [],
      summaryKeys.length > 0 ? redis.mget(...summaryKeys) : [],
    ]);

    const leaderboard: LeaderboardEntry[] = usernames.map((username, idx) => {
      const completed = parseInt(completedResults[idx] || '0', 10);
      const summaryData = summaryResults[idx];
      const timestamp = summaryData ? JSON.parse(summaryData).lastUpdated : 0;
      return {
        rank: idx + 1,
        username,
        score: scores[idx],
        completedPuzzles: completed,
        timestamp,
      };
    });

    // If username provided, also get their rank if not in top N
    let userRank: LeaderboardEntry | null = null;
    if (usernameParam) {
      const userRankNumber = await redis.zrank(leaderboardKey, usernameParam);
      if (userRankNumber !== null) {
        const isInTopN = userRankNumber < limit;

        if (!isInTopN) {
          const userScore = await redis.zscore(leaderboardKey, usernameParam);
          const completedKey = `chesserGuesser:completed:${dateString}:${usernameParam}`;
          const completed = parseInt((await redis.get(completedKey)) || '0', 10);
          const summaryKey = `chesserGuesser:summary:${dateString}:${usernameParam}`;
          const summaryData = await redis.get(summaryKey);
          const timestamp = summaryData ? JSON.parse(summaryData).lastUpdated : 0;

          userRank = {
            rank: userRankNumber + 1,
            username: usernameParam,
            score: parseInt(userScore || '0', 10),
            completedPuzzles: completed,
            timestamp,
          };
        }
      }
    }

    // Get total number of players
    const totalPlayers = await redis.zcard(leaderboardKey);

    return Response.json({
      leaderboard,
      userRank,
      totalPlayers,
      date: dateString,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=60', // Cache for 1 minute
      },
    });
  } catch (error) {
    console.error('Leaderboard API error:', error);
    return Response.json(
      { error: 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
