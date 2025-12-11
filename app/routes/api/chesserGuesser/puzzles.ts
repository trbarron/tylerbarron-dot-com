// API Route: Get daily puzzles
// GET /api/chesserGuesser/puzzles?date=YYYY-MM-DD

import type { LoaderFunctionArgs } from "react-router";
import { getRedisClient } from "~/utils/redis.server";
import { getTodayDateString } from "~/utils/chesserGuesser/seededRandom";
import type { ChessPuzzle, DailyPuzzleSet } from "~/utils/chesserGuesser/types";

const REDIS_KEY_PREFIX = 'chesserGuesser:dailyPuzzles:';
const TTL_7_DAYS = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Fetch daily puzzles by calling the existing endpoint
 * Uses Redis cache to ensure all users get the same puzzles each day
 *
 * The strategy:
 * 1. On first request for a date, fetch 4 puzzles from the Lambda
 * 2. Cache them in Redis with the date as key
 * 3. All subsequent requests for that date get the cached puzzles
 *
 * This ensures deterministic daily puzzles without modifying the Lambda
 */
async function fetchDailyPuzzles(): Promise<ChessPuzzle[]> {
  const puzzles: ChessPuzzle[] = [];

  // Fetch 4 puzzles sequentially to ensure we get valid ones
  for (let i = 0; i < 4; i++) {
    let retries = 3;
    while (retries > 0) {
      try {
        const response = await fetch(
          'https://f73vgbj1jk.execute-api.us-west-2.amazonaws.com/prod/chesserGuesser',
          {
            signal: AbortSignal.timeout(10000), // 10 second timeout
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch puzzle ${i}: ${response.status}`);
        }

        const data = await response.json();
        const parsedBody = JSON.parse(data.body);

        puzzles.push({
          fen: parsedBody.fen,
          eval: parseInt(parsedBody.eval, 10),
        });

        break; // Success, move to next puzzle
      } catch (error) {
        retries--;
        console.error(`Error fetching puzzle ${i} (${3 - retries}/3):`, error);

        if (retries === 0) {
          // Use a fallback puzzle if all retries fail
          console.error(`Failed to fetch puzzle ${i} after 3 retries, using fallback`);
          puzzles.push({
            fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            eval: 0,
          });
        } else {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
  }

  return puzzles;
}

/**
 * Get or generate daily puzzles for a specific date
 * Uses Redis to ensure everyone gets the same puzzles each day
 */
async function getDailyPuzzles(dateString: string): Promise<DailyPuzzleSet> {
  try {
    const redis = getRedisClient();
    const redisKey = `${REDIS_KEY_PREFIX}${dateString}`;

    // Check if puzzles are cached in Redis
    const cached = await redis.get(redisKey);
    if (cached) {
      console.log(`Using cached puzzles for ${dateString}`);
      return JSON.parse(cached);
    }

    console.log(`Generating new puzzles for ${dateString}`);

    // Fetch 4 puzzles from Lambda
    // The Redis cache ensures everyone gets the same puzzles for the day
    const puzzles = await fetchDailyPuzzles();

    const dailySet: DailyPuzzleSet = {
      date: dateString,
      puzzles,
      seed: parseInt(dateString.replace(/-/g, ''), 10),
    };

    // Cache in Redis with 7-day TTL
    // This is the key: first request generates and caches, all others read from cache
    await redis.setex(redisKey, TTL_7_DAYS, JSON.stringify(dailySet));

    console.log(`Cached new puzzles for ${dateString}`);

    return dailySet;
  } catch (error) {
    console.error('Error getting daily puzzles:', error);
    throw error;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const dateString = dateParam || getTodayDateString();

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return Response.json(
        { error: 'Invalid date format. Use YYYY-MM-DD.' },
        { status: 400 }
      );
    }

    const puzzleSet = await getDailyPuzzles(dateString);

    return Response.json(puzzleSet, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Puzzles API error:', error);
    return Response.json(
      { error: 'Failed to fetch daily puzzles' },
      { status: 500 }
    );
  }
}
