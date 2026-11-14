import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { checkRateLimit } from '~/utils/rateLimit.server';
import {
  cleanText,
  createPoll,
  mutatePoll,
  PollError,
  readPoll,
  validId,
  validToken,
  validateList,
} from '~/utils/bookClub/polls.server';
import { validBallot } from '~/utils/bookClub/types';

const HEADERS = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer' };
const json = (body: unknown, status = 200, extra = {}) =>
  Response.json(body, { status, headers: { ...HEADERS, ...extra } });
function failure(error: unknown) {
  if (error instanceof PollError) return json({ error: error.message }, error.status);
  console.error('bookClub request failed', error);
  return json({ error: 'Could not reach book club right now. Please try again.' }, 503);
}
function credentials(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? '';
  if (token && !validToken(token)) throw new PollError('Invalid session.', 403);
  return token;
}
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const id = new URL(request.url).searchParams.get('id') ?? '';
    if (!validId(id)) throw new PollError('Invalid invite link.', 404);
    return json(await readPoll(id, credentials(request)));
  } catch (error) {
    return failure(error);
  }
}
export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'POST' });
  try {
    const raw = await request.text();
    if (raw.length > 16000) return json({ error: 'This list is too large.' }, 413);
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch {
      throw new PollError('Please send valid JSON.');
    }
    const kind = body.kind;
    let mutation: Record<string, unknown> = {};
    let list: ReturnType<typeof validateList> | undefined;
    if (kind === 'create') list = validateList(body);
    else {
      if (typeof body.id !== 'string' || !validId(body.id)) throw new PollError('Invalid invite link.', 404);
      if (!validToken(credentials(request))) throw new PollError('A voter or host session is required.', 403);
      if (kind === 'join') {
        const name = cleanText(body.name, 40);
        mutation = { kind, name, nameKey: name.normalize('NFKC').toLowerCase() };
      } else if (kind === 'vote') {
        if (!validBallot(body.ballot)) throw new PollError('Choose two different books up and a third book down.');
        mutation = { kind, ballot: body.ballot };
      } else if (kind === 'close') mutation = { kind };
      else throw new PollError('Unknown action.');
    }
    const limit = await checkRateLimit(request, 'bookClub', String(kind), {
      max: kind === 'create' ? 10 : 120,
      windowSeconds: 3600,
    });
    if (!limit.allowed)
      return json({ error: 'Too many requests. Try again later.' }, 429, { 'Retry-After': String(limit.retryAfter) });
    if (list) return json(await createPoll(list), 201);
    await mutatePoll(body.id as string, credentials(request), mutation);
    return json(await readPoll(body.id as string, credentials(request)));
  } catch (error) {
    return failure(error);
  }
}
