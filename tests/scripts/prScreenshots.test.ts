import { describe, it, expect } from 'vitest';
import { captureWidths, widthLabel, serverCommand } from '../../scripts/lib/pr-screenshots.mjs';

describe('portable PR screenshot configuration', () => {
  it('passes a custom local port to a configured server command without shell interpolation', () => {
    expect(
      serverCommand(['npm', 'run', 'dev', '--', '--host', '{hostname}', '--port', '{port}'], 'http://127.0.0.1:5197'),
    ).toEqual(['npm', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '5197']);
    expect(() => serverCommand(['npm', 'start'], 'https://example.com')).toThrow('loopback');
  });
  it('rejects invalid widths and gives distinct names to multiple desktop/phone sizes', () => {
    expect(captureWidths('1280,1920,390,375,1280')).toEqual([1280, 1920, 390, 375]);
    expect(new Set([1280, 1920, 390, 375].map(widthLabel)).size).toBe(4);
    expect(() => captureWidths('NaN,0')).toThrow('Widths');
  });
});

describe('book-club screenshot scenarios', () => {
  it('covers the reachable views with stable synthetic identities and both confirmations', async () => {
    const { captureScenarios, scenarioStorageState } = await import('../../scripts/lib/pr-screenshots.mjs');
    const captures = await captureScenarios('book-club', '/ignored');
    expect(captures.map((capture) => capture.name)).toEqual([
      'create',
      'join',
      'ballot',
      'up-spent',
      'down-spent',
      'multiple',
      'multiple-remove',
      'confirm',
      'locked',
      'host',
      'host-closed',
      'host-link',
      'close',
      'results',
    ]);
    const host = captures.find((capture) => capture.name === 'host')!;
    const a = scenarioStorageState(host, 'https://tylerbarron.com');
    const b = scenarioStorageState(host, 'http://127.0.0.1:5197');
    expect(a.origins[0].localStorage).toEqual(b.origins[0].localStorage);
    expect(a.origins[0].origin).not.toEqual(b.origins[0].origin);
    expect(captures.find((capture) => capture.name === 'confirm')!.steps).toHaveLength(4);
    await expect(captureScenarios('../unsafe', '/')).rejects.toThrow('Unknown');
    expect(await captureScenarios(undefined, '/pizza-rating')).toEqual([{ route: '/pizza-rating' }]);
  });
  it('fulfills synthetic reads and blocks writes and unknown queries before they can reach a server', async () => {
    const { prepareScenario } = await import('../../scripts/lib/pr-screenshots.mjs');
    let handler: (route: unknown) => Promise<void> = async () => {};
    const errors: string[] = [];
    await prepareScenario(
      {
        route: async (_pattern: string, cb: typeof handler) => {
          handler = cb;
        },
      },
      { responses: { '/api/test?id=fixture': { test: true } } },
      errors,
    );
    const { vi } = await import('vitest');
    const fulfill = vi.fn(),
      abort = vi.fn();
    const read = {
      request: () => ({ method: () => 'GET', url: () => 'https://tylerbarron.com/api/test?id=fixture' }),
      fulfill,
      abort,
    };
    await handler(read);
    expect(fulfill).toHaveBeenCalledWith(expect.objectContaining({ body: JSON.stringify({ test: true }) }));
    await handler({
      ...read,
      request: () => ({ method: () => 'POST', url: () => 'https://tylerbarron.com/api/test?id=fixture' }),
    });
    await handler({
      ...read,
      request: () => ({ method: () => 'GET', url: () => 'https://tylerbarron.com/api/test?id=real' }),
    });
    expect(abort).toHaveBeenCalledTimes(2);
    expect(errors).toHaveLength(2);
    expect(fulfill).toHaveBeenCalledTimes(1);
  });
});

describe('volatile screenshot masks', () => {
  it('combines configured, scenario and repeated CLI masks for both origins', async () => {
    const { captureMasks } = await import('../../scripts/lib/pr-screenshots.mjs');
    const page = { locator: (selector: string) => ({ selector }) };
    const config = { maskSelectors: ['footer .version'] };
    const argv = ['--mask', '[data-hash]', '--mask', '.timestamp'];
    const masks = captureMasks(page, config, argv, { maskSelectors: ['footer .version', '.poll-id'] });
    expect(masks).toEqual({
      maskColor: '#FFFFFF',
      mask: ['footer .version', '.poll-id', '[data-hash]', '.timestamp'].map((selector) => ({ selector })),
    });
    expect(captureMasks(page, config, ['--no-masks'])).toEqual({});
    expect(() => captureMasks(page, config, ['--mask'])).toThrow('nonempty');
  });
});
