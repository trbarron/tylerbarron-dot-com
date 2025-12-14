// API Route: Submit puzzle score
// POST /api/chesserGuesser/submit
// Body: { username, date, puzzleIndex, guess, actualEval }

import type { ActionFunctionArgs } from "react-router";
import { getRedisClient } from "~/utils/redis.server";
import { calculatePuzzleScore } from "~/utils/chesserGuesser/puzzleSelection";
import { getTodayDateString } from "~/utils/chesserGuesser/seededRandom";

const TTL_30_DAYS = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Validate username
 */
function validateUsername(username: string): boolean {
  // 1-20 characters, alphanumeric and underscores only
  return /^[a-zA-Z0-9_]{1,20}$/.test(username);
}

/**
 * Submit a puzzle attempt and update leaderboard
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== 'POST') {
      return Response.json({ error: 'Method not allowed' }, { status: 405 });
    }

    const body = await request.json();
    const { username, date, puzzleIndex, guess, actualEval } = body;

    // Validate inputs
    if (!validateUsername(username)) {
      return Response.json(
        { error: 'Invalid username. Use 1-20 alphanumeric characters or underscores.' },
        { status: 400 }
      );
    }

    const dateString = date || getTodayDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return Response.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    if (typeof puzzleIndex !== 'number' || puzzleIndex < 0 || puzzleIndex > 3) {
      return Response.json(
        { error: 'Invalid puzzle index. Must be 0-3.' },
        { status: 400 }
      );
    }

    if (typeof guess !== 'number' || typeof actualEval !== 'number') {
      return Response.json(
        { error: 'Invalid guess or actualEval. Must be numbers.' },
        { status: 400 }
      );
    }

    const redis = getRedisClient();

    // Check if user already submitted this puzzle
    const submissionKey = `chesserGuesser:submission:${dateString}:${username}:${puzzleIndex}`;
    const existing = await redis.get(submissionKey);

    if (existing) {
      return Response.json(
        { error: 'You already submitted for the day' },
        { status: 409 }
      );
    }

    // Calculate score
    const score = calculatePuzzleScore(guess, actualEval);

    // Store individual submission
    const submission = {
      username,
      date: dateString,
      puzzleIndex,
      guess,
      actualEval,
      score,
      timestamp: Date.now(),
    };

    await redis.setex(
      submissionKey,
      TTL_30_DAYS,
      JSON.stringify(submission)
    );

    // Update user's total score for the day
    const userScoreKey = `chesserGuesser:userScore:${dateString}:${username}`;
    const currentScore = parseInt((await redis.get(userScoreKey)) || '0', 10);
    const newTotalScore = currentScore + score;

    await redis.setex(
      userScoreKey,
      TTL_30_DAYS,
      newTotalScore.toString()
    );

    // Update puzzles completed count
    const completedKey = `chesserGuesser:completed:${dateString}:${username}`;
    const completed = parseInt((await redis.get(completedKey)) || '0', 10);
    const newCompleted = completed + 1;

    await redis.setex(
      completedKey,
      TTL_30_DAYS,
      newCompleted.toString()
    );

    // Update leaderboard ONLY if all 4 puzzles are completed
    if (newCompleted === 4) {
      const leaderboardKey = `chesserGuesser:leaderboard:${dateString}`;
      await redis.zadd(leaderboardKey, newTotalScore, username);
      await redis.expire(leaderboardKey, TTL_30_DAYS);
    }

    // Update user summary
    const summaryKey = `chesserGuesser:summary:${dateString}:${username}`;
    const summary = {
      username,
      date: dateString,
      totalScore: newTotalScore,
      puzzlesCompleted: newCompleted,
      lastUpdated: Date.now(),
    };

    await redis.setex(
      summaryKey,
      TTL_30_DAYS,
      JSON.stringify(summary)
    );

    return Response.json({
      success: true,
      score,
      totalScore: newTotalScore,
      puzzlesCompleted: newCompleted,
    });
  } catch (error) {
    console.error('Submit API error:', error);
    return Response.json(
      { error: 'Failed to submit puzzle score' },
      { status: 500 }
    );
  }
}
