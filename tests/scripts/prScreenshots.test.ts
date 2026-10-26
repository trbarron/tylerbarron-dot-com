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
