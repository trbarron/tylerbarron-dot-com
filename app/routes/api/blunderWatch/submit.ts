// POST /api/blunderWatch/submit
// Body: { username, date, flags: [{ moveIndex, reactionTimeMs }] }
//
// Fetches blunder indices from Redis independently and re-calculates score
// server-side to prevent client-side score manipulation.

import type { ActionFunctionArgs } from 'react-router';
import { getRedisClient } from '~/utils/redis.server';
import { calculateScore } from '~/utils/blunderWatch/scoring';
import type { Flag } from '~/utils/blunderWatch/types';

const TTL_7_DAYS = 7 * 24 * 60 * 60;

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

function validateUsername(u: string): boolean {
  return /^[a-zA-Z0-9_]{1,20}$/.test(u);
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { username, date: dateParam, flags } = body;
    const date = dateParam || getTodayDateString();

    if (!validateUsername(username)) {
      return Response.json(
        { error: 'Invalid username. Use 1–20 alphanumeric characters or underscores.' },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'Invalid date format.' }, { status: 400 });
    }

    if (!Array.isArray(flags)) {
      return Response.json({ error: 'flags must be an array.' }, { status: 400 });
    }

    const redis = getRedisClient();

    // Prevent duplicate submissions
    const submissionKey = `blunderWatch:submission:${date}:${username}`;
    const existing = await redis.get(submissionKey);
    if (existing) {
      return Response.json({ error: 'You already submitted for today.' }, { status: 409 });
    }

    // Fetch authoritative game data from Redis
    const gameRaw = await redis.get(`blunderWatch:game:${date}`);
    if (!gameRaw) {
      return Response.json({ error: `No game found for ${date}.` }, { status: 404 });
    }

    const game = JSON.parse(gameRaw);
    const { blunderIndices, evals, gameId } = game;

    // Validate flags are within bounds
    const validFlags: Flag[] = (flags as Flag[]).filter(
      f =>
        typeof f.moveIndex === 'number' &&
        f.moveIndex >= 0 &&
        f.moveIndex < game.moves.length &&
        typeof f.reactionTimeMs === 'number' &&
        f.reactionTimeMs >= 0
    );

    // Server-side score calculation — ignores any client-side score claims
    const result = calculateScore(validFlags, blunderIndices, evals);
    const gameNumber = parseInt(gameId.replace('bw-', ''), 10);
    const maxScore = blunderIndices.length * 100;

    const submission = {
      username,
      date,
      score: result.totalScore,
      blundersCaught: result.blundersCaught,
      blundersMissed: result.blundersMissed,
      falsePositives: result.falsePositives,
      resultEmoji: result.resultEmoji,
      gameNumber,
      maxScore,
      timestamp: Date.now(),
    };

    // Store submission (atomic NX to guard against race conditions)
    const wasSet = await redis.set(
      submissionKey,
      JSON.stringify(submission),
      'EX',
      TTL_7_DAYS,
      'NX'
    );

    if (!wasSet) {
      return Response.json({ error: 'You already submitted for today.' }, { status: 409 });
    }

    // Update leaderboard ZSET — higher score = better rank, stored as positive value
    const leaderboardKey = `blunderWatch:leaderboard:${date}`;
    // Tie-break: encode timestamp into score fractional part so earlier timestamps rank higher
    // Score = totalScore * 1e9 + (1e9 - timestamp_offset) — keeps Redis sort reliable
    const tieBreakScore = result.totalScore * 1e9 + (1e9 - (Date.now() % 1e9));
    await redis.zadd(leaderboardKey, tieBreakScore, username);
    await redis.expire(leaderboardKey, TTL_7_DAYS);

    // Store summary for leaderboard display
    const summaryKey = `blunderWatch:summary:${date}:${username}`;
    await redis.setex(summaryKey, TTL_7_DAYS, JSON.stringify(submission));

    // Get user's rank (1-based)
    // ZREVRANK gives 0-based rank in descending order
    const rankRaw = await redis.zrevrank(leaderboardKey, username);
    const rank = rankRaw !== null ? rankRaw + 1 : null;
    const totalPlayers = await redis.zcard(leaderboardKey);

    return Response.json({
      ...result,
      rank,
      totalPlayers,
    });
  } catch (error) {
    console.error('BlunderWatch submit API error:', error);
    return Response.json({ error: 'Failed to submit score.' }, { status: 500 });
  }
}
