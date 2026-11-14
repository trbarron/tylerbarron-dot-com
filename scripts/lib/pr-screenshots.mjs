import fs from 'node:fs';
import path from 'node:path';

export function readCaptureConfig(root, file = 'pr-screenshots.config.json') {
  const filename = path.resolve(root, file);
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : {};
}
export function captureWidths(value) {
  const widths = Array.isArray(value) ? value.map(Number) : String(value).split(',').map(Number);
  if (!widths.length || widths.some((w) => !Number.isInteger(w) || w < 200 || w > 3840))
    throw new Error('Widths must be integers between 200 and 3840.');
  return [...new Set(widths)];
}
export const widthLabel = (w) =>
  w === 1280 ? 'desktop' : w === 390 ? 'phone' : `${w <= 600 ? 'phone' : 'desktop'}-${w}`;
export function serverCommand(command, origin) {
  const url = new URL(origin);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
    throw new Error('Only a loopback --local URL can start a development server.');
  if (!Array.isArray(command) || !command.length || command.some((arg) => typeof arg !== 'string'))
    throw new Error('Configure startCommand as a nonempty argument array.');
  const variables = { port: url.port || (url.protocol === 'https:' ? '443' : '80'), hostname: url.hostname };
  return command.map((arg) => arg.replace(/\{(port|hostname)\}/g, (_, name) => variables[name]));
}
export async function readyForCapture(page, selector) {
  if (selector) await page.locator(selector).first().waitFor({ state: 'visible' });
  let timer;
  try {
    await Promise.race([
      page.evaluate(async () => {
        await document.fonts.ready;
        for (const image of document.images) image.loading = 'eager';
        const failures = [];
        await Promise.all(
          [...document.images]
            .filter((img) => img.currentSrc || img.src)
            .map(async (image) => {
              try {
                await image.decode();
              } catch {
                failures.push(image.currentSrc || image.src);
              }
            }),
        );
        if (failures.length) throw new Error(`Images failed to load: ${failures.slice(0, 5).join(', ')}`);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Page assets did not become ready within 30 seconds.')), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function revealFocus(locator) {
  await locator.evaluate((element) => {
    for (let p = element.parentElement; p; p = p.parentElement) if (p instanceof HTMLDetailsElement) p.open = true;
  });
  if (!(await locator.isVisible()))
    throw new Error('Focused element is hidden; provide a visible focus or an appropriate --open control.');
  await locator.scrollIntoViewIfNeeded();
}
export async function openControl(locator) {
  const alreadyOpen = await locator.evaluate(
    (element) => element.closest('details')?.open || element.getAttribute('aria-expanded') === 'true',
  );
  if (!alreadyOpen) await locator.click();
}

/**
 * @typedef {Object} Capture
 * @property {string} route
 * @property {string} [name]
 * @property {string} [title]
 * @property {Record<string, string>} [storage]
 * @property {Record<string, unknown>} [responses]
 * @property {string} [readySelector]
 * @property {string[]} [steps]
 * @property {string} [finalReady]
 */
/**
 * Named, repository-owned fixtures; no arbitrary module paths from the CLI.
 * @returns {Promise<Capture[]>}
 */
export async function captureScenarios(name, route) {
  if (!name) return [{ route }];
  if (name !== 'book-club') throw new Error(`Unknown screenshot scenario: ${name}`);
  const { scenarios } = await import('../fixtures/book-club.mjs');
  return scenarios();
}
export function scenarioStorageState(capture, origin) {
  return {
    cookies: [],
    origins: [
      {
        origin: new URL(origin).origin,
        localStorage: Object.entries(capture.storage ?? {}).map(([name, value]) => ({ name, value })),
      },
    ],
  };
}

/** Intercept only the named synthetic API reads on both origins; forbid writes. */
export async function prepareScenario(page, capture, errors) {
  if (!capture.responses) return;
  const responses = capture.responses;
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = url.pathname + url.search;
    if (request.method() !== 'GET' || !Object.hasOwn(responses, key)) {
      errors.push('Scenario attempted an unconfigured API request; no request was sent.');
      await route.abort('blockedbyclient');
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Cache-Control': 'no-store' },
      body: JSON.stringify(responses[key]),
    });
  });
}
