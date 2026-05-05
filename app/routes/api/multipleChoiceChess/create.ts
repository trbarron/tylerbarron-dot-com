import type { ActionFunctionArgs } from "react-router";
import {
  createGame,
  generateGameId,
  generatePlayerId,
  getGame,
} from "~/utils/multipleChoiceChess/gameState.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
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
      state,
    });
  } catch (err) {
    console.error('Create game error:', err);
    return Response.json({ error: 'Failed to create game' }, { status: 500 });
  }
}
