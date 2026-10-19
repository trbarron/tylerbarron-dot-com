import type { LoaderFunctionArgs } from 'react-router';
import { getGame, touchPlayer } from '~/utils/multipleChoiceChess/gameState.server';

const SEEN_WRITE_MS = 3_000;

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
    // abandonment when polling stops. At most every SEEN_WRITE_MS per player:
    // the banner and claim-win thresholds are 45 s and 90 s, so finer is wasted writes.
    if (playerId && game.status !== 'complete') {
      const color = game.white_id === playerId ? 'white' : game.black_id === playerId ? 'black' : null;
      const lastSeen = color === 'white' ? game.white_last_seen : game.black_last_seen;
      if (color && Date.now() - lastSeen >= SEEN_WRITE_MS) await touchPlayer(gameId, color);
    }

    return Response.json(game, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('State fetch error:', err);
    return Response.json({ error: 'Failed to fetch game state' }, { status: 500 });
  }
}
