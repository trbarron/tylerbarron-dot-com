import type { ActionFunctionArgs } from 'react-router';
import { playerAction } from '~/utils/collaborativeCheckmate/game.server';
import { parseAction, parseGameId, parsePlayerId } from '~/utils/collaborativeCheckmate/validate';

/** Take a seat, ready up, submit or lock in a move. Replies with the new state, plus `error` if refused. */
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const gameId = parseGameId(body?.gameId);
  const playerId = parsePlayerId(body?.playerId);
  const playerAct = parseAction(body?.action);
  if (!gameId || !playerId || !playerAct) return Response.json({ error: 'Bad request.' }, { status: 400 });
  try {
    const { game, error } = await playerAction(gameId, playerId, playerAct);
    if (!game) return Response.json({ error: error ?? 'Game not found.' }, { status: 404 });
    return Response.json({ game, error }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Collaborative Checkmate action error:', err);
    return Response.json({ error: 'Could not do that. Try again.' }, { status: 500 });
  }
}
