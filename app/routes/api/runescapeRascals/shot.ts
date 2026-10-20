// API Route: a bot's latest in-game screenshot
// GET /api/runescapeRascals/shot/:name

import type { LoaderFunctionArgs } from 'react-router';
import { readShot } from '~/utils/runescapeRascals/snapshot.server';
import { BOT_NAMES } from '~/utils/runescapeRascals/types';

// Screenshots are taken every 10 minutes; callers add ?t=<shotAt> to bust the cache.
const CACHE = 'public, max-age=300, s-maxage=300';

export async function loader({ params }: LoaderFunctionArgs) {
  const name = params.name ?? '';
  if (!(BOT_NAMES as readonly string[]).includes(name)) {
    return Response.json({ error: 'Unknown character.' }, { status: 404 });
  }
  try {
    const jpeg = await readShot(name);
    if (!jpeg) return Response.json({ error: 'No screenshot yet.' }, { status: 404 });
    return new Response(new Uint8Array(jpeg), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': CACHE },
    });
  } catch (error) {
    console.error('Error reading Runescape Rascals screenshot:', error);
    return Response.json({ error: 'Could not load the screenshot.' }, { status: 500 });
  }
}
