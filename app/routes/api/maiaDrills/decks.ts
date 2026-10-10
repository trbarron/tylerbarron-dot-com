// API Route: Maia Drills decks
//
// POST /api/maiaDrills/decks                        -> { id, editToken }  save a deck
// GET  /api/maiaDrills/decks?id=xx                  -> { deck }           read one back
// GET  /api/maiaDrills/decks                        -> { decks }          the global favorites list
// PUT  /api/maiaDrills/decks  { id, editToken, favorite } -> { id, favorite }
// PATCH /api/maiaDrills/decks { id, editToken, cards, stats, newestGameAt }
//                                                   -> { added, cardCount, newestGameAt }
//      add new games' cards to a deck; the server merges, so a stale client can't drop cards
//
// Analysis happens entirely in the browser; this route only stores the cards
// it produced. See docs/maia-drills.md.

import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  MAX_BODY_BYTES,
  addToDeck,
  isValidEditToken,
  isValidId,
  listFavorites,
  loadDeck,
  saveDeck,
  setFavorite,
  validateAddition,
  validateDeck,
} from '~/utils/maiaDrills/decks.server';
import {
  FAVORITE_LIMIT,
  READ_LIMIT,
  SAVE_LIMIT,
  checkRateLimit,
} from '~/utils/maiaDrills/rateLimit.server';

function tooMany(retryAfter: number, message = 'Too many requests. Try again later.') {
  return Response.json({ error: message }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });
}

async function readJsonBody(request: Request): Promise<{ body: unknown } | { error: Response }> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return { error: Response.json({ error: 'Deck is too large.' }, { status: 413 }) };
  }
  try {
    return { body: JSON.parse(raw) };
  } catch {
    return { error: Response.json({ error: 'Body must be valid JSON.' }, { status: 400 }) };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === 'PUT') return handleFavorite(request);
  if (request.method === 'PATCH') return handleAdd(request);
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const limit = await checkRateLimit(request, 'save', SAVE_LIMIT);
  if (!limit.allowed) return tooMany(limit.retryAfter, 'Too many decks saved from this address. Try again later.');

  const parsed = await readJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const validated = validateDeck(parsed.body);
  if (!validated.ok) return Response.json({ error: validated.error }, { status: 400 });

  try {
    const { id, editToken } = await saveDeck(validated.value);
    return Response.json({ id, editToken }, { status: 201 });
  } catch (error) {
    console.error('maiaDrills: failed to save deck', error);
    return Response.json({ error: 'Could not save the deck right now.' }, { status: 503 });
  }
}

async function handleAdd(request: Request) {
  // Same budget as saving: each add is a full analysis run's worth of cards.
  const limit = await checkRateLimit(request, 'add', SAVE_LIMIT);
  if (!limit.allowed) return tooMany(limit.retryAfter);

  const parsed = await readJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const { id, editToken } = (parsed.body ?? {}) as Record<string, unknown>;
  if (typeof id !== 'string' || !isValidId(id)) {
    return Response.json({ error: 'Missing or malformed id.' }, { status: 400 });
  }
  const validated = validateAddition(parsed.body);
  if (!validated.ok) return Response.json({ error: validated.error }, { status: 400 });

  try {
    // No token is fine for a favorite: anyone can add newer games to one.
    const token = typeof editToken === 'string' && isValidEditToken(editToken) ? editToken : null;
    const result = await addToDeck(id, token, validated.value);
    if (result.outcome === 'not-found') {
      return Response.json({ error: 'That deck has expired or never existed.' }, { status: 404 });
    }
    if (result.outcome === 'forbidden') {
      return Response.json(
        { error: 'Only the browser that built this deck can add to it until it’s a favorite.' },
        { status: 403 }
      );
    }
    const { added, cardCount, newestGameAt } = result;
    return Response.json({ added, cardCount, newestGameAt });
  } catch (error) {
    console.error('maiaDrills: failed to add to deck', error);
    return Response.json({ error: 'Could not update the deck right now.' }, { status: 503 });
  }
}

async function handleFavorite(request: Request) {
  const limit = await checkRateLimit(request, 'favorite', FAVORITE_LIMIT);
  if (!limit.allowed) return tooMany(limit.retryAfter);

  const parsed = await readJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const { id, editToken, favorite } = (parsed.body ?? {}) as Record<string, unknown>;
  if (typeof id !== 'string' || !isValidId(id)) {
    return Response.json({ error: 'Missing or malformed id.' }, { status: 400 });
  }
  if (typeof favorite !== 'boolean') {
    return Response.json({ error: '"favorite" must be true or false.' }, { status: 400 });
  }
  if (typeof editToken !== 'string' || !isValidEditToken(editToken)) {
    return Response.json({ error: 'Only the browser that built this deck can change it.' }, { status: 403 });
  }

  try {
    const outcome = await setFavorite(id, editToken, favorite);
    if (outcome === 'not-found') {
      return Response.json({ error: 'That deck has expired or never existed.' }, { status: 404 });
    }
    if (outcome === 'forbidden') {
      return Response.json({ error: 'Only the browser that built this deck can change it.' }, { status: 403 });
    }
    return Response.json({ id, favorite });
  } catch (error) {
    console.error('maiaDrills: failed to update favorite', error);
    return Response.json({ error: 'Could not update the deck right now.' }, { status: 503 });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const params = new URL(request.url).searchParams;
  const id = params.get('id');
  if (id !== null && !isValidId(id)) return Response.json({ error: 'Malformed id.' }, { status: 400 });

  const limit = await checkRateLimit(request, 'read', READ_LIMIT);
  if (!limit.allowed) return tooMany(limit.retryAfter);

  try {
    if (id) {
      const deck = await loadDeck(id);
      if (!deck) return Response.json({ error: 'That deck has expired or never existed.' }, { status: 404 });
      // Favoriting rewrites the deck, so a cached copy would show a stale star.
      return Response.json({ deck }, { headers: { 'Cache-Control': 'no-store' } });
    }
    // Uncached: someone who just favorited a deck expects to see it listed.
    const decks = await listFavorites();
    return Response.json({ decks }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('maiaDrills: failed to read decks', error);
    return Response.json({ error: 'Could not load decks right now.' }, { status: 503 });
  }
}
