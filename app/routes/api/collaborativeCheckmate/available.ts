import { listOpenGames } from '~/utils/collaborativeCheckmate/game.server';

export async function loader() {
  try {
    return Response.json({ games: await listOpenGames() }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('Collaborative Checkmate lobby error:', err);
    return Response.json({ error: 'Could not load games.' }, { status: 500 });
  }
}
