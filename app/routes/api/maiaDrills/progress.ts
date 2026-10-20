// API Route: Maia Drills progress, shared by every device drilling a deck.
//
// GET    /api/maiaDrills/progress?deck=xx                    -> { completed }  the completed card ids
// POST   /api/maiaDrills/progress { deck, completed: [ids] }  -> { completed }  mark cards completed
// DELETE /api/maiaDrills/progress?deck=xx                    -> { completed: [] }  reset the deck
//
// Completion is sticky: a card stays completed until a reset, however many
// sessions answer it afterwards. See markCompleted in decks.server.ts.

import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { CARD_ID_RE, isValidId, loadCompleted, markCompleted, resetCompleted } from '~/utils/maiaDrills/decks.server';
import { LIMITS } from '~/utils/maiaDrills/types';
import { PROGRESS_LIMIT, READ_LIMIT, RESET_LIMIT, checkRateLimit } from '~/utils/maiaDrills/rateLimit.server';

const GONE = 'That deck has expired or never existed.';
const NO_STORE = { 'Cache-Control': 'no-store' };

function tooMany(retryAfter: number) {
  return Response.json(
    { error: 'Too many requests. Try again later.' },
    { status: 429, headers: { 'Retry-After': String(retryAfter) } },
  );
}

function unavailable(what: string, error: unknown) {
  console.error(`maiaDrills: failed to ${what} progress`, error);
  return Response.json({ error: 'Could not reach progress right now.' }, { status: 503 });
}

/** A request's card ids: 1 to a deck's worth of well-formed ids, deduplicated. */
function cardIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > LIMITS.cardsPerDeck) return null;
  if (!raw.every((id) => typeof id === 'string' && CARD_ID_RE.test(id))) return null;
  return [...new Set(raw as string[])];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const id = new URL(request.url).searchParams.get('deck');
  if (!id || !isValidId(id)) return Response.json({ error: 'Missing or malformed deck id.' }, { status: 400 });
  const limit = await checkRateLimit(request, 'read', READ_LIMIT);
  if (!limit.allowed) return tooMany(limit.retryAfter);
  try {
    const completed = await loadCompleted(id);
    if (!completed) return Response.json({ error: GONE }, { status: 404 });
    return Response.json({ completed }, { headers: NO_STORE });
  } catch (error) {
    return unavailable('read', error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === 'DELETE') return handleReset(request);
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const limit = await checkRateLimit(request, 'progress', PROGRESS_LIMIT);
  if (!limit.allowed) return tooMany(limit.retryAfter);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) ?? {};
  } catch {
    return Response.json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }
  const { deck, completed } = body;
  if (typeof deck !== 'string' || !isValidId(deck)) {
    return Response.json({ error: 'Missing or malformed deck id.' }, { status: 400 });
  }
  const ids = cardIds(completed);
  if (!ids) return Response.json({ error: '"completed" must be a list of card ids.' }, { status: 400 });

  try {
    const result = await markCompleted(deck, ids);
    if (result.outcome === 'not-found') return Response.json({ error: GONE }, { status: 404 });
    if (result.outcome === 'full') {
      return Response.json({ error: 'This deck’s progress is full. Reset it to start again.' }, { status: 409 });
    }
    return Response.json({ completed: result.completed }, { headers: NO_STORE });
  } catch (error) {
    return unavailable('save', error);
  }
}

async function handleReset(request: Request) {
  const limit = await checkRateLimit(request, 'reset', RESET_LIMIT);
  if (!limit.allowed) return tooMany(limit.retryAfter);
  const id = new URL(request.url).searchParams.get('deck');
  if (!id || !isValidId(id)) return Response.json({ error: 'Missing or malformed deck id.' }, { status: 400 });
  try {
    if ((await resetCompleted(id)) === 'not-found') return Response.json({ error: GONE }, { status: 404 });
    return Response.json({ completed: [] }, { headers: NO_STORE });
  } catch (error) {
    return unavailable('reset', error);
  }
}
