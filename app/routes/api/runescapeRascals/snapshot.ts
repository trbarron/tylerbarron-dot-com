// API Route: the party's latest snapshot
// GET /api/runescapeRascals/snapshot

import { readSnapshot } from '~/utils/runescapeRascals/snapshot.server';

// The orchestrator publishes every 15 seconds, so a short shared cache loses nothing.
const CACHE = 'public, max-age=10, s-maxage=10';

export async function loader() {
  try {
    const snapshot = await readSnapshot();
    return Response.json({ snapshot }, { headers: { 'Cache-Control': CACHE } });
  } catch (error) {
    console.error('Error reading Runescape Rascals snapshot:', error);
    return Response.json({ error: 'Could not load the party.' }, { status: 500 });
  }
}
