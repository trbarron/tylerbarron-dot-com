import { readdirSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync('infra/cloudfront/viewer-request.js', 'utf8');
function invoke(host: string, ip: string, uri = '/blog/example') {
  const event = {
    viewer: { ip },
    request: {
      uri,
      headers: { host: { value: host }, 'x-site-viewer-ip': { value: 'forged' } },
      querystring: {
        tag: { value: 'one', multiValue: [{ value: 'one' }, { value: 'two%20words' }] },
        empty: { value: '' },
      },
    },
  };
  return { event, result: runInNewContext(source + '\nhandler(event)', { event }) };
}

const isProbe = (uri: string) => invoke('tylerbarron.com', '203.0.113.7', uri).result.statusCode === 404;

// Every route the site serves, with parameters filled in, plus the URLs React
// Router itself requests: single-fetch data (.data) and lazy route discovery.
const routePaths = [...readFileSync('app/routes.ts', 'utf8').matchAll(/route\('([^']+)'/g)]
  .map((m) => m[1])
  .filter((path) => path !== '*')
  .map((path) => '/' + path.replace(/:[A-Za-z]+/g, 'x1'));
const postPaths = readdirSync('posts')
  .filter((file) => file.endsWith('.mdx'))
  .map((file) => '/blog/' + file.replace(/\.mdx$/, ''));
const sitePaths = [
  '/',
  '/_root.data',
  '/__manifest',
  '/.well-known/security.txt',
  '/no-such-page',
  ...routePaths,
  ...postPaths,
];

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

  it('passes every route, data request and blog post through to the site', () => {
    expect(routePaths.length).toBeGreaterThan(40);
    const blocked = [...sitePaths, ...sitePaths.map((path) => (path === '/' ? '/_root.data' : path + '.data'))].filter(
      isProbe,
    );
    expect(blocked).toEqual([]);
  });

  // Taken from requests that reached the Lambda in November 2026.
  it.each([
    '/wp-admin/admin-ajax.php',
    '/index.php',
    '/wp-json/batch/v1',
    '/blog/wp-json/batch/v1',
    '/wp-json/batch/v1/..;/batch/v1',
    '/xmlrpc.php',
    '/mbilling/index.php/authentication/login',
    '/Admin/login.php',
    '/sys/ui/extend/varkind/custom.jsp',
    '/tmui/locallb/workspace/tmshCmd.jsp',
    '/CFIDE/wizards/common/utils.cfc',
    '/lucee/admin/imgProcess.cfm',
    '/pages/createpage-entervariables.action',
    '/ioffice/prg/set/wss/ioAssistance.asmx',
    '/GNRemote.dll',
    '/cgi-bin/luci/;stok=/locale',
    '/scgi-bin/platform.cgi',
    '/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php',
    '/_ignition/execute-solution',
    '/_next',
    '/.env',
    '/api/.env',
    '/.git/config',
    '/.aws/credentials',
  ])('answers the probe %s with a 404 at the edge', (uri) => {
    const { result } = invoke('tylerbarron.com', '203.0.113.7', uri);
    expect(result.statusCode).toBe(404);
    expect(result.body).toEqual({ encoding: 'text', data: 'Not Found' });
  });

  it('answers a probe on www without redirecting it first', () => {
    expect(invoke('www.tylerbarron.com', '203.0.113.7', '/wp-login.php').result.statusCode).toBe(404);
  });
});
