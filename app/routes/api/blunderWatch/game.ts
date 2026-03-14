// GET /api/blunderWatch/game?date=YYYY-MM-DD

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
    const pacing = computePacing(stored.moves.length, stored.blunderIndices);

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
