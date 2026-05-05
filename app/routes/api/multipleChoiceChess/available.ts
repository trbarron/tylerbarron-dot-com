import type { LoaderFunctionArgs } from "react-router";
import { getAvailableGames } from "~/utils/multipleChoiceChess/gameState.server";

export async function loader(_: LoaderFunctionArgs) {
  try {
    const games = await getAvailableGames();
    return Response.json({ games });
  } catch (err) {
    console.error('Available games error:', err);
    return Response.json({ error: 'Failed to fetch available games' }, { status: 500 });
  }
}
