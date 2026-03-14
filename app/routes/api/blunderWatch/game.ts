// GET /api/blunderWatch/game?date=YYYY-MM-DD
//
// Returns today's game. Games are pre-loaded into Redis via load_games.py.
// The pacing schedule is computed server-side and included so the client
// can drive playback timing without knowing raw blunder indices.
// (Blunder indices ARE returned for live client-side feedback; the submit
//  endpoint re-validates them server-side to prevent score tampering.)

import type { LoaderFunctionArgs } from 'react-router';
import { getRedisClient } from '~/utils/redis.server';
import { computePacing } from '~/utils/blunderWatch/pacing';

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const url = new URL(request.url);
    const dateParam = url.searchParams.get('date');
    const date = dateParam || getTodayDateString();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const redis = getRedisClient();
    const raw = await redis.get(`blunderWatch:game:${date}`);

    if (!raw) {
      return Response.json(
        { error: `No game scheduled for ${date}. Check back soon!` },
        { status: 404 }
      );
    }

    const stored = JSON.parse(raw);

    // Compute pacing server-side so the client drives timing without guessing blunder positions
    const pacing = computePacing(stored.moves.length, stored.blunderIndices);

    // Return full game data. Blunder indices are included for live feedback;
    // the submit route re-validates independently.
    return Response.json(
      {
        gameNumber: stored.gameId ? parseInt(stored.gameId.replace('bw-', ''), 10) : 0,
        date: stored.date,
        whiteElo: stored.whiteElo,
        blackElo: stored.blackElo,
        moves: stored.moves,
        blunderCount: stored.blunderIndices.length,
        blunderIndices: stored.blunderIndices,
        evals: stored.evals,
        pacing,
      },
      {
        headers: { 'Cache-Control': 'public, max-age=3600' },
      }
    );
  } catch (error) {
    console.error('BlunderWatch game API error:', error);
    return Response.json({ error: 'Failed to fetch game' }, { status: 500 });
  }
}
