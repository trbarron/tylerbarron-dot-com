/**
 * Tests for the CDN image URL helpers. The CDN base is read from the
 * environment at module load, so we stub it to a fixed value (rather than
 * relying on whatever .env happens to provide) and pin the path-composition,
 * and leading-slash handling.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

const CDN = 'https://cdn.test';
let cdn: typeof import('~/utils/cdn');

beforeAll(async () => {
  vi.stubEnv('VITE_CDN_URL', CDN);
  vi.resetModules();
  cdn = await import('~/utils/cdn');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('getImageUrl', () => {
  it('composes a CDN /images/ URL', () => {
    expect(cdn.getImageUrl('SSBM/falco1.jpg')).toBe(`${CDN}/images/SSBM/falco1.jpg`);
  });

  it('strips a leading slash from the input path', () => {
    expect(cdn.getImageUrl('/SSBM/falco1.jpg')).toBe(`${CDN}/images/SSBM/falco1.jpg`);
  });
});
