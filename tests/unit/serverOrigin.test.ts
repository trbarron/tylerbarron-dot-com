import { afterEach, describe, expect, it, vi } from 'vitest';

const { serve } = vi.hoisted(() => ({ serve: vi.fn(async () => ({ statusCode: 200, body: 'rendered' })) }));
vi.mock('@ballatech/react-router7-preset-aws', () => ({ createRequestHandler: () => serve }));
import { handler } from '../../server';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('Lambda origin guard', () => {
  it('rejects direct requests before routing, including healthcheck and assets', async () => {
    vi.stubEnv('ARC_ENV', 'production');
    vi.stubEnv('ORIGIN_VERIFY', 'test-secret');
    for (const rawPath of ['/healthcheck', '/api/multipleChoiceChess/create', '/assets/missing.js']) {
      const response = await handler({ rawPath, headers: { 'x-origin-verify': 'forged' } }, {});
      expect(response).toEqual({
        statusCode: 403,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        body: 'Forbidden',
      });
    }
    expect(serve).not.toHaveBeenCalled();
  });

  it('passes an authorized request to the adapter unchanged', async () => {
    vi.stubEnv('ARC_ENV', 'production');
    vi.stubEnv('ORIGIN_VERIFY', 'test-secret');
    const event = {
      rawPath: '/healthcheck',
      headers: { 'x-origin-verify': 'test-secret', 'x-site-viewer-ip': '203.0.113.7' },
    };
    const context = {};
    expect(await handler(event, context)).toEqual({ statusCode: 200, body: 'rendered' });
    expect(serve).toHaveBeenCalledWith(event, context, {});
  });
});
