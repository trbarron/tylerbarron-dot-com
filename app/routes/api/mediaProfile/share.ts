// API Route: Media Format Appreciation Profile shared results
//
// POST /api/mediaProfile/share        -> { id, editToken }  save a result
// PUT  /api/mediaProfile/share        -> { id }             replace one you own
// GET  /api/mediaProfile/share?id=xx  -> { result }         read one back
//
// All three live in one route because they are verbs on one resource and
// React Router gives a route a loader and an action for exactly that.
//
// The edit token is what separates PUT from POST: it is minted once, returned
// once, and kept only by the browser that saved the card. Holding the share
// link gets you the read, never the write.

import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  MAX_BODY_BYTES,
  isValidEditToken,
  isValidId,
  loadResult,
  saveResult,
  updateResult,
  validateResult,
} from '~/utils/mediaProfile/share.server';
import {
  EDIT_LIMIT,
  READ_LIMIT,
  SHARE_LIMIT,
  checkRateLimit,
} from '~/utils/mediaProfile/rateLimit.server';

/**
 * Read and parse the body, returning a Response instead when it is too large
 * or not JSON. Reading as text first means an oversized body is rejected
 * before anything tries to parse it.
 */
async function readJsonBody(request: Request): Promise<{ body: unknown } | { error: Response }> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return { error: Response.json({ error: 'Result is too large.' }, { status: 413 }) };
  }
  try {
    return { body: JSON.parse(raw) };
  } catch {
    return { error: Response.json({ error: 'Body must be valid JSON.' }, { status: 400 }) };
  }
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method === 'PUT') return handleUpdate(request);
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const limit = await checkRateLimit(request, 'share', SHARE_LIMIT);
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many results saved from this address. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  const parsed = await readJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const validated = validateResult(parsed.body);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  try {
    const { id, editToken } = await saveResult(validated.value);
    return Response.json({ id, editToken }, { status: 201 });
  } catch (error) {
    console.error('mediaProfile: failed to save result', error);
    return Response.json({ error: 'Could not save your result right now.' }, { status: 503 });
  }
}

async function handleUpdate(request: Request) {
  const limit = await checkRateLimit(request, 'edit', EDIT_LIMIT);
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many edits from this address. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  const parsed = await readJsonBody(request);
  if ('error' in parsed) return parsed.error;

  const { id, editToken } = (parsed.body ?? {}) as Record<string, unknown>;
  if (typeof id !== 'string' || !isValidId(id)) {
    return Response.json({ error: 'Missing or malformed id.' }, { status: 400 });
  }
  if (typeof editToken !== 'string' || !isValidEditToken(editToken)) {
    // Shape-only: a token of the wrong form never reaches the compare, and the
    // message stays the same as a wrong one so neither is distinguishable.
    return Response.json({ error: 'That card is not yours to edit.' }, { status: 403 });
  }

  const validated = validateResult(parsed.body);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  try {
    const outcome = await updateResult(id, editToken, validated.value);
    if (outcome === 'not-found') {
      return Response.json({ error: 'That card has expired or never existed.' }, { status: 404 });
    }
    if (outcome === 'forbidden') {
      return Response.json({ error: 'That card is not yours to edit.' }, { status: 403 });
    }
    return Response.json({ id }, { status: 200 });
  } catch (error) {
    console.error('mediaProfile: failed to update result', error);
    return Response.json({ error: 'Could not save your changes right now.' }, { status: 503 });
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const id = new URL(request.url).searchParams.get('id');

  // Shape-check before Redis: a malformed id is a 400, and costs no round trip.
  if (!id || !isValidId(id)) {
    return Response.json({ error: 'Missing or malformed id.' }, { status: 400 });
  }

  const limit = await checkRateLimit(request, 'read', READ_LIMIT);
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  try {
    const result = await loadResult(id);
    if (!result) {
      return Response.json({ error: 'That result has expired or never existed.' }, { status: 404 });
    }
    return Response.json(
      { result },
      // Cards are editable now, so a cached copy is a wrong copy: an author who
      // just saved would be handed their old answers to edit again. One read
      // per page load is not worth caching against that.
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('mediaProfile: failed to load result', error);
    return Response.json({ error: 'Could not load that result right now.' }, { status: 503 });
  }
}
