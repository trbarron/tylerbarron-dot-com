import type { ActionFunctionArgs } from 'react-router';
import {
  joinGame,
  generatePlayerId,
  getAvailableGames,
  getGame,
  normalizeGameId,
  publicView,
} from '~/utils/multipleChoiceChess/gameState.server';

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { game_id?: unknown } | null;
    if (body?.game_id && !normalizeGameId(body.game_id)) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }

    let targetGameId = normalizeGameId(body?.game_id) ?? undefined;

    // If no game_id supplied, attempt quick match from the available queue
    if (!targetGameId) {
      const available = await getAvailableGames();
      if (available.length === 0) {
        return Response.json({ error: 'No available games. Create one instead.' }, { status: 404 });
      }
      targetGameId = available[0].game_id;
    }

    const game = await getGame(targetGameId);
    if (!game) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.status !== 'waiting') {
      return Response.json({ error: 'Game is no longer available' }, { status: 409 });
    }

    const playerId = generatePlayerId();
    const updated = await joinGame(targetGameId, playerId);

    if (!updated) {
      // Someone else took the seat between the check above and the join.
      return Response.json({ error: 'Game is no longer available' }, { status: 409 });
    }

    return Response.json({
      game_id: targetGameId,
      player_id: playerId,
      color: 'black',
      state: publicView(updated, playerId),
    });
  } catch (err) {
    console.error('Join game error:', err);
    return Response.json({ error: 'Failed to join game' }, { status: 500 });
  }
}
