import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync('infra/cloudfront/viewer-request.js', 'utf8');
function invoke(host: string, ip: string) {
  const event = {
    viewer: { ip },
    request: {
      uri: '/blog/example',
      headers: { host: { value: host }, 'x-site-viewer-ip': { value: 'forged' } },
      querystring: {
        tag: { value: 'one', multiValue: [{ value: 'one' }, { value: 'two%20words' }] },
        empty: { value: '' },
      },
    },
  };
  return { event, result: runInNewContext(source + '\nhandler(event)', { event }) };
}

describe('CloudFront viewer-request function', () => {
  it.each(['203.0.113.7', '2001:db8::1234'])('overwrites forged addresses with %s', (ip) => {
    const { event, result } = invoke('tylerbarron.com', ip);
    expect(result).toBe(event.request);
    expect(result.headers['x-site-viewer-ip'].value).toBe(ip);
  });

  it('preserves the www redirect, including repeated, encoded and empty query values', () => {
    const { result } = invoke('www.tylerbarron.com', '203.0.113.7');
    expect(result.statusCode).toBe(301);
    expect(result.headers.location.value).toBe('https://tylerbarron.com/blog/example?tag=one&tag=two%20words&empty');
    expect(result.headers['cache-control'].value).toBe('max-age=3600');
  });
});
