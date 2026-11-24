import assert from 'node:assert/strict';
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const server = path.resolve(import.meta.dirname, '../server');
const files = await readdir(server);
assert.deepEqual(files.sort(), ['chunks', 'index.mjs', 'package.json'], 'Unexpected files in the Lambda package');

// Run outside the repo so missing imports cannot resolve from the root node_modules.
const temp = await mkdtemp(path.join(tmpdir(), 'site-lambda-smoke-'));
try {
  await cp(server, temp, { recursive: true });
  process.env.NODE_ENV = 'production';
  process.env.ARC_ENV = 'production';
  process.env.ORIGIN_VERIFY = 'local-smoke-test';
  const redis = process.env.TEST_REDIS_URL;
  if (redis) {
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(redis).hostname), 'Use disposable local Redis');
    process.env.REDIS_URL = redis;
  }

  const { handler } = await import(pathToFileURL(path.join(temp, 'index.mjs')).href);
  const request = (rawPath, headers) =>
    handler(
      {
        version: '2.0',
        rawPath,
        rawQueryString: '',
        headers: { host: 'tylerbarron.com', 'user-agent': 'Googlebot/2.1', ...headers },
        requestContext: { http: { method: 'GET' } },
      },
      {},
    );
  const origin = { 'x-origin-verify': process.env.ORIGIN_VERIFY };
  assert.equal((await request('/')).statusCode, 403);
  const pages = ['/', '/blog/fastballMPHDifference', '/blog/triple-bypass', '/pizza-rating', '/camel-up-cup'];
  if (redis) pages.push('/multiple-choice-chess');
  for (const page of pages) {
    const response = await request(page, origin);
    assert.equal(response.statusCode, 200, page);
    assert.match(response.body, /<html\b[\s\S]*<footer\b/i, page);
    console.log('✓ %s', page);
  }
  if (redis) {
    const response = await request('/healthcheck', origin);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.trim(), 'OK');
    console.log('✓ Redis healthcheck');
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
// The Lambda intentionally keeps its Redis connection open across requests.
process.exit(0);
