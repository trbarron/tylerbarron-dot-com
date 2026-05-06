import type { LoaderFunctionArgs } from "react-router";
import { getGame, touchPlayer } from "~/utils/multipleChoiceChess/gameState.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const gameId = url.searchParams.get('gameId');
  const playerId = url.searchParams.get('playerId');

  if (!gameId) {
    return Response.json({ error: 'gameId required' }, { status: 400 });
  }

  try {
    const game = await getGame(gameId.toLowerCase().trim());
    if (!game) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }

    // Touch the requesting player's last_seen so the opponent can detect
    // abandonment when polling stops.
    if (playerId && game.status !== 'complete') {
      if (game.white_id === playerId) {
        await touchPlayer(gameId, 'white');
      } else if (game.black_id === playerId) {
        await touchPlayer(gameId, 'black');
      }
    }

    return Response.json(game, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('State fetch error:', err);
    return Response.json({ error: 'Failed to fetch game state' }, { status: 500 });
  }
}
