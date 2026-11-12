import { isRedisAvailable } from '~/utils/redis.server';

// Answering at all shows the Lambda is up and routing; the ping shows it can
// reach Redis. It used to also fetch its own homepage at a URL built from the
// request's Host headers, which let a caller aim that request anywhere and
// doubled the cost of every call.
export async function loader() {
  try {
    if (!(await isRedisAvailable())) {
      return new Response('Redis NOT READY', { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return new Response('OK', { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    console.error('healthcheck ❌', { error });
    return new Response('ERROR', { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
