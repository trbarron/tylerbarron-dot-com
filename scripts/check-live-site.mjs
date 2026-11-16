import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export const ROUTES = ['/', '/blog/fastballMPHDifference', '/multiple-choice-chess', '/pizza-rating', '/healthcheck'];

export async function checkLiveSite({
  baseUrl = 'https://tylerbarron.com',
  deploy = process.env.GITHUB_SHA ?? String(Date.now()),
  version = process.env.APP_VERSION,
  fetchImpl = fetch,
  attempts = 4,
  delay = () => setTimeout(3000),
  log = console.log,
} = {}) {
  for (const route of ROUTES) {
    const url = new URL(route, baseUrl);
    url.searchParams.set('deploy', deploy);
    let failure;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        const response = await fetchImpl(url, {
          headers: { 'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)', 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(15000),
          redirect: 'error',
        });
        const body = await response.text();
        if (response.status !== 200) throw new Error(`HTTP ${response.status}`);
        if (route === '/healthcheck') {
          if (body.trim() !== 'OK') throw new Error('Redis healthcheck did not return OK');
        } else {
          if (!body.includes('<html') || !body.includes('<footer')) throw new Error('Incomplete server-rendered page');
          // The footer confirms the new build reached the edge, rather than an older cached page.
          if (version && !body.includes(`v${version} · ${deploy.slice(0, 7)}`)) {
            throw new Error('Page is not serving the expected build version and commit');
          }
        }
        failure = undefined;
        log(`✓ ${route} 200`);
        break;
      } catch (error) {
        failure = error;
        log(`${route} attempt ${attempt}/${attempts}: ${error.message}`);
        if (attempt < attempts) await delay();
      }
    }
    if (failure) throw new Error(`Live check failed for ${route}: ${failure.message}`, { cause: failure });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkLiveSite({ baseUrl: process.argv[2] ?? 'https://tylerbarron.com' });
}
