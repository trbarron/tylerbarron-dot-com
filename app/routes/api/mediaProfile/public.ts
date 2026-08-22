// API Route: the Media Format Appreciation Profile cards people published
//
// GET /api/mediaProfile/public[?limit=n] -> { cards: [{ id, result }] }
//
// Only cards whose author ticked "show this publicly" appear here. Everything
// else stays reachable by its share link alone.

import type { LoaderFunctionArgs } from 'react-router';
import { PUBLIC_PAGE_MAX, listPublicResults } from '~/utils/mediaProfile/share.server';
import { LIST_LIMIT, checkRateLimit } from '~/utils/mediaProfile/rateLimit.server';

const DEFAULT_LIMIT = 25;

export async function loader({ request }: LoaderFunctionArgs) {
  const limit = await checkRateLimit(request, 'list', LIST_LIMIT);
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    );
  }

  const requested = Number(new URL(request.url).searchParams.get('limit'));
  const count =
    Number.isInteger(requested) && requested > 0
      ? Math.min(requested, PUBLIC_PAGE_MAX)
      : DEFAULT_LIMIT;

  try {
    const cards = await listPublicResults(count);
    return Response.json(
      { cards },
      // Short and shared: the list is the same for everyone, and a card added a
      // minute ago showing up a minute late is nobody's problem. Somebody
      // watching for their own edit is a different matter, so the post asks for
      // that refresh under a one-off `t`, which misses this cache by design.
      { headers: { 'Cache-Control': 'public, max-age=60' } }
    );
  } catch (error) {
    console.error('mediaProfile: failed to list public results', error);
    return Response.json({ error: 'Could not load the responses right now.' }, { status: 503 });
  }
}
