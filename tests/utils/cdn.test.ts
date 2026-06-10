/**
 * Tests for the CDN image URL helpers. The CDN base is read from the
 * environment at module load, so we stub it to a fixed value (rather than
 * relying on whatever .env happens to provide) and pin the path-composition,
 * leading-slash handling, responsive srcset, and modern-format logic.
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

describe('getResponsiveSrcSet', () => {
  it('emits 400/800/1200 width descriptors with the given extension', () => {
    expect(cdn.getResponsiveSrcSet('SSBM/falco1', 'webp')).toBe(
      `${CDN}/images/SSBM/falco1-400.webp 400w, ` +
        `${CDN}/images/SSBM/falco1-800.webp 800w, ` +
        `${CDN}/images/SSBM/falco1-1200.webp 1200w`,
    );
  });

  it('defaults to jpg', () => {
    expect(cdn.getResponsiveSrcSet('SSBM/falco1')).toContain(`${CDN}/images/SSBM/falco1-400.jpg 400w`);
  });
});

describe('getModernImageSources', () => {
  it('returns avif/webp srcsets and the original-format fallback', () => {
    const sources = cdn.getModernImageSources('SSBM/falco1', 'jpg');
    expect(sources.fallback).toBe(`${CDN}/images/SSBM/falco1.jpg`);
    expect(sources.avif).toContain(`${CDN}/images/SSBM/falco1-800.avif 800w`);
    expect(sources.webp).toContain(`${CDN}/images/SSBM/falco1-1200.webp 1200w`);
  });
});

describe('image', () => {
  it('composes a typed directory + filename', () => {
    expect(cdn.image('SSBM', 'falco1.jpg')).toBe(`${CDN}/images/SSBM/falco1.jpg`);
  });
});
