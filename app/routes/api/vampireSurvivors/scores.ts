import type { ActionFunctionArgs } from 'react-router';
import { checkRateLimit } from '~/utils/rateLimit.server';
import { parseRecorderScore, saveRecorderScore } from '~/utils/vampireSurvivors/leaderboard.server';

export async function action({ request }: ActionFunctionArgs) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'POST') {
    return Response.json({ error: 'Use POST.' }, { status: 405, headers: { ...headers, Allow: 'POST' } });
  }
  if (request.headers.get('Content-Type')?.split(';')[0]?.trim() !== 'application/json') {
    return Response.json({ error: 'Use JSON.' }, { status: 415, headers });
  }

  const body = await request.text();
  if (body.length > 1024) return Response.json({ error: 'Score is too large.' }, { status: 413, headers });

  let score;
  try {
    score = parseRecorderScore(JSON.parse(body));
  } catch {
    score = null;
  }
  if (!score) return Response.json({ error: 'Invalid score.' }, { status: 400, headers });

  const limit = await checkRateLimit(request, 'vampire-survivors', 'scores', { max: 30, windowSeconds: 3600 });
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many score submissions.' },
      { status: 429, headers: { ...headers, 'Retry-After': String(limit.retryAfter) } },
    );
  }

  try {
    return Response.json({ improved: await saveRecorderScore(score) }, { headers });
  } catch (error) {
    console.error('Vampire Survivors leaderboard write failed:', error);
    return Response.json({ error: 'Leaderboard unavailable.' }, { status: 503, headers });
  }
}
