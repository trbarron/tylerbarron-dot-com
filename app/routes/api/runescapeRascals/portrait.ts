import type { LoaderFunctionArgs } from 'react-router';
import { readPortrait } from '~/utils/runescapeRascals/snapshot.server';
import { BOT_NAMES } from '~/utils/runescapeRascals/types';

export async function loader({ params, request }: LoaderFunctionArgs) {
  const name = params.name ?? '';
  const kind = params.kind;
  if (!(BOT_NAMES as readonly string[]).includes(name) || (kind !== 'head' && kind !== 'body')) {
    return Response.json({ error: 'Unknown portrait.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const angle = Number(new URL(request.url).searchParams.get('a') ?? 0);
  if (!Number.isInteger(angle) || angle < 0 || angle > 63) {
    return Response.json({ error: 'Unknown view.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  try {
    const png = await readPortrait(name, kind, angle);
    if (!png)
      return Response.json({ error: 'No portrait yet.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    return new Response(new Uint8Array(png), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
  } catch (error) {
    console.error('Error reading Runescape Rascals portrait:', error);
    return Response.json(
      { error: 'Could not load portrait.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
