import type { ActionFunctionArgs } from 'react-router';
import {
  createGame,
  generateGameId,
  generatePlayerId,
  getGame,
  publicView,
} from '~/utils/multipleChoiceChess/gameState.server';
import { checkRateLimit } from '~/utils/rateLimit.server';

// Each game is a day-long Redis key, and anyone can ask for one.
const CREATE_LIMIT = { max: 20, windowSeconds: 3600 };

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const limit = await checkRateLimit(request, 'multipleChoiceChess', 'create', CREATE_LIMIT);
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many games started from this address. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  try {
    // Generate a unique game ID, retrying on collision
    let gameId = generateGameId();
    for (let i = 0; i < 5; i++) {
      const existing = await getGame(gameId);
      if (!existing) break;
      gameId = generateGameId();
    }

    const playerId = generatePlayerId();
    const state = await createGame(gameId, playerId);

    return Response.json({
      game_id: gameId,
      player_id: playerId,
      color: 'white',
      state: publicView(state, playerId),
    });
  } catch (err) {
    console.error('Create game error:', err);
    return Response.json({ error: 'Failed to create game' }, { status: 500 });
  }
}
