// API Route: Media Format Appreciation Profile shared results
//
// POST /api/mediaProfile/share        -> { id }        save a result
// GET  /api/mediaProfile/share?id=xx  -> { result }    read one back
//
// Both halves live in one route because they are two verbs on one resource and
// React Router gives a route a loader and an action for exactly that.

import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import {
  MAX_BODY_BYTES,
  isValidId,
  loadResult,
  saveResult,
  validateResult,
} from '~/utils/mediaProfile/share.server';
import {
  READ_LIMIT,
  SHARE_LIMIT,
  checkRateLimit,
} from '~/utils/mediaProfile/rateLimit.server';

export async function action({ request }: ActionFunctionArgs) {
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

  // Read as text first so an oversized body is rejected before it is parsed.
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: 'Result is too large.' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'Body must be valid JSON.' }, { status: 400 });
  }

  const validated = validateResult(body);
  if (!validated.ok) {
    return Response.json({ error: validated.error }, { status: 400 });
  }

  try {
    const id = await saveResult(validated.value);
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    console.error('mediaProfile: failed to save result', error);
    return Response.json({ error: 'Could not save your result right now.' }, { status: 503 });
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
      // Shared results never change once written, so anything that fetches one
      // may hold onto it. Private: the URL is the only access control.
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (error) {
    console.error('mediaProfile: failed to load result', error);
    return Response.json({ error: 'Could not load that result right now.' }, { status: 503 });
  }
}
