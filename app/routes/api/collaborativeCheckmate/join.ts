import type { ActionFunctionArgs } from 'react-router';
import { joinGame } from '~/utils/collaborativeCheckmate/game.server';
import { parseGameId, parsePlayerId } from '~/utils/collaborativeCheckmate/validate';
import { checkRateLimit } from '~/utils/rateLimit.server';

/** Open a game (creating it if the code is new) and take the first free seat. */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const gameId = parseGameId(body?.gameId);
  const playerId = parsePlayerId(body?.playerId);
  if (!gameId || !playerId) {
    return Response.json({ error: 'Use a game code and username of letters, numbers, - or _.' }, { status: 400 });
  }
  try {
    const limit = await checkRateLimit(request, 'collaborativeCheckmate', 'join', { max: 60, windowSeconds: 3600 });
    if (!limit.allowed) {
      return Response.json(
        { error: 'Too many games joined from this address. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
      );
    }
    const game = await joinGame(gameId, playerId, body?.isPrivate === true);
    return Response.json(game, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Collaborative Checkmate join error:', err);
    return Response.json({ error: 'Could not join the game.' }, { status: 500 });
  }
}
