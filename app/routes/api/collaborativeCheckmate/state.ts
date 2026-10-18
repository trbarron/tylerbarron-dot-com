import type { LoaderFunctionArgs } from 'react-router';
import { getGame } from '~/utils/collaborativeCheckmate/game.server';
import { parseGameId, parsePlayerId } from '~/utils/collaborativeCheckmate/validate';

/** The poll (every POLL_MS). Also how turns end: see game.server.ts. */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const gameId = parseGameId(url.searchParams.get('gameId'));
  if (!gameId) return Response.json({ error: 'Bad game code.' }, { status: 400 });
  const playerId = parsePlayerId(url.searchParams.get('playerId'));
  try {
    const game = await getGame(gameId, playerId);
    if (!game) return Response.json({ error: 'Game not found.' }, { status: 404 });
    return Response.json(game, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Collaborative Checkmate state error:', err);
    return Response.json({ error: 'Could not load the game.' }, { status: 500 });
  }
}
