/**
 * Tests for /healthcheck route
 * The self-fetch must use https in production (API Gateway/CloudFront are
 * HTTPS-only; a hardcoded http:// scheme made the healthcheck always 500).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { LoaderFunctionArgs } from 'react-router';
import { loader } from '~/routes/healthcheck';

// Mock Redis availability check
const mockIsRedisAvailable = vi.fn();
vi.mock('~/utils/redis.server', () => ({
  isRedisAvailable: () => mockIsRedisAvailable(),
}));

function createArgs(headers: Record<string, string>): LoaderFunctionArgs {
  return {
    request: new Request('https://example.com/healthcheck', { headers }),
    params: {},
    context: {},
  } as unknown as LoaderFunctionArgs;
}

describe('healthcheck loader', () => {
  const originalFetch = global.fetch;
  let fetchedUrl: string | undefined;

  beforeEach(() => {
    fetchedUrl = undefined;
    mockIsRedisAvailable.mockResolvedValue(true);
    global.fetch = vi.fn(async (url: RequestInfo | URL) => {
      fetchedUrl = url.toString();
      return new Response(null, { status: 200 });
    }) as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it('self-fetches over https for a production host', async () => {
    const response = await loader(createArgs({ host: 'tylerbarron.com' }));
    expect(fetchedUrl).toBe('https://tylerbarron.com/');
    expect(response.status).toBe(200);
  });

  it('honors X-Forwarded-Proto when present', async () => {
    await loader(
      createArgs({ host: 'tylerbarron.com', 'X-Forwarded-Proto': 'http' })
    );
    expect(fetchedUrl).toBe('http://tylerbarron.com/');
  });

  it('uses http for localhost (arc sandbox / dev)', async () => {
    await loader(createArgs({ host: 'localhost:3333' }));
    expect(fetchedUrl).toBe('http://localhost:3333/');
  });

  it('prefers X-Forwarded-Host over host', async () => {
    await loader(
      createArgs({ host: 'internal.execute-api.aws', 'X-Forwarded-Host': 'tylerbarron.com' })
    );
    expect(fetchedUrl).toBe('https://tylerbarron.com/');
  });

  it('returns 503 when Redis is not ready', async () => {
    mockIsRedisAvailable.mockResolvedValue(false);
    const response = await loader(createArgs({ host: 'tylerbarron.com' }));
    expect(response.status).toBe(503);
  });

  it('returns 500 when the self-fetch fails', async () => {
    global.fetch = vi.fn(async () => new Response(null, { status: 500 })) as typeof fetch;
    const response = await loader(createArgs({ host: 'tylerbarron.com' }));
    expect(response.status).toBe(500);
  });
});
