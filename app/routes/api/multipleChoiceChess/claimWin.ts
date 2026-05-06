import type { ActionFunctionArgs } from "react-router";
import { getGame, claimWinByAbandonment } from "~/utils/multipleChoiceChess/gameState.server";

// A player can claim a win if their opponent's last_seen is older than this.
// The threshold is enforced server-side; a stale client can't end a live game.
const ABANDONMENT_THRESHOLD_MS = 90_000;

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

    const claimingColor: 'white' | 'black' = isWhite ? 'white' : 'black';
    const opponentLastSeen = isWhite ? game.black_last_seen : game.white_last_seen;
    const inactiveFor = Date.now() - opponentLastSeen;

    if (opponentLastSeen === 0 || inactiveFor < ABANDONMENT_THRESHOLD_MS) {
      return Response.json(
        { error: 'Opponent is still active', inactiveForMs: inactiveFor },
        { status: 409 },
      );
    }

    await claimWinByAbandonment(gameId, claimingColor);

    return Response.json({ ok: true });
  } catch (err) {
    console.error('Claim win error:', err);
    return Response.json({ error: 'Failed to claim win' }, { status: 500 });
  }
}
