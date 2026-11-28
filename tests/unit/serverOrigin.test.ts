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

  it('uses the public hostname for an authorized production request', async () => {
    vi.stubEnv('ARC_ENV', 'production');
    vi.stubEnv('ORIGIN_VERIFY', 'test-secret');
    const event = {
      rawPath: '/healthcheck',
      rawQueryString: 'probe=1',
      headers: {
        Host: 'internal.example',
        'x-forwarded-host': 'invalid host',
        'X-Forwarded-Host': 'viewer.example',
        'x-origin-verify': 'test-secret',
        'x-site-viewer-ip': '203.0.113.7',
      },
    };
    const context = {};
    expect(await handler(event, context)).toEqual({ statusCode: 200, body: 'rendered' });
    expect(serve).toHaveBeenCalledWith(
      {
        ...event,
        headers: { host: 'tylerbarron.com', 'x-origin-verify': 'test-secret', 'x-site-viewer-ip': '203.0.113.7' },
      },
      context,
      {},
    );
  });

  it('rejects an invalid production request target before routing', async () => {
    vi.stubEnv('ARC_ENV', 'production');
    vi.stubEnv('ORIGIN_VERIFY', 'test-secret');
    const event = { rawPath: 'healthcheck', rawQueryString: '', headers: { 'x-origin-verify': 'test-secret' } };
    expect(await handler(event, {})).toMatchObject({ statusCode: 400, headers: { 'Cache-Control': 'no-store' } });
    expect(serve).not.toHaveBeenCalled();
  });

  it('passes headers the Fetch API can hold when a client sends characters above U+00FF', async () => {
    vi.stubEnv('ARC_ENV', 'production');
    vi.stubEnv('ORIGIN_VERIFY', 'test-secret');
    const userAgent = 'Mozilla/5.0 (Linux; Android 14; 小米 14) Mobile �';
    const cookie = 'name=Zoë 🙂';
    // What the adapter does with them, and what failed in production on 27 November.
    expect(() => new Headers().append('user-agent', userAgent)).toThrow(TypeError);

    const event = {
      rawPath: '/',
      rawQueryString: '',
      headers: { 'x-origin-verify': 'test-secret', 'user-agent': userAgent, accept: 'text/html' },
      cookies: [cookie, 'plain=1'],
    };
    expect(await handler(event, {})).toEqual({ statusCode: 200, body: 'rendered' });

    const [forwarded] = serve.mock.calls[0] as unknown as [{ headers: Record<string, string>; cookies: string[] }];
    const headers = new Headers();
    for (const [name, value] of Object.entries(forwarded.headers)) headers.append(name, value);
    headers.append('Cookie', forwarded.cookies.join('; '));

    expect(Buffer.from(headers.get('user-agent')!, 'latin1').toString('utf8')).toBe(userAgent);
    expect(Buffer.from(headers.get('cookie')!, 'latin1').toString('utf8')).toBe(`${cookie}; plain=1`);
    expect(headers.get('accept')).toBe('text/html');
  });

  it('preserves the staging hostname', async () => {
    vi.stubEnv('ARC_ENV', 'staging');
    const event = { rawPath: '/healthcheck', rawQueryString: '', headers: { host: 'staging.example' } };
    const context = {};
    expect(await handler(event, context)).toMatchObject({ statusCode: 200 });
    expect(serve).toHaveBeenCalledWith(event, context, {});
  });
});
