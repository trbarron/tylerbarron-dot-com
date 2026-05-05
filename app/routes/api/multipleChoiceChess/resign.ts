import type { ActionFunctionArgs } from "react-router";
import { getGame, resignGame } from "~/utils/multipleChoiceChess/gameState.server";

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json() as { game_id: string; player_id: string };
    const { game_id: gameId, player_id: playerId } = body;

    if (!gameId || !playerId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const game = await getGame(gameId.toLowerCase().trim());
    if (!game) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.status !== 'active') {
      return Response.json({ error: 'Game is not active' }, { status: 409 });
    }

    const isWhite = game.white_id === playerId;
    const isBlack = game.black_id === playerId;
    if (!isWhite && !isBlack) {
      return Response.json({ error: 'Not a player in this game' }, { status: 403 });
    }

    const resigningColor: 'white' | 'black' = isWhite ? 'white' : 'black';
    await resignGame(gameId, resigningColor);

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Resign error:', err);
    return Response.json({ error: 'Failed to resign' }, { status: 500 });
  }
}
