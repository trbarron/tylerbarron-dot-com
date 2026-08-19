/**
 * Tests for /api/mediaProfile/share route
 * Covers payload validation, id round-tripping, and the failure responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createActionArgs, createLoaderArgs } from '../setup';
import { action, loader } from '~/routes/api/mediaProfile/share';
import { generateId, isValidId, validateResult } from '~/utils/mediaProfile/share.server';

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  expire: vi.fn(),
  incr: vi.fn(),
};

vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => mockRedis,
}));

function postArgs(body: unknown) {
  return createActionArgs('/api/mediaProfile/share', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('Media Profile share API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.expire.mockResolvedValue(1);
    // Rate limiter: first call in the window.
    mockRedis.incr.mockResolvedValue(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateResult', () => {
    it('accepts a well-formed result', () => {
      const result = validateResult({
        scores: { movies: 30, 'books.fiction': 80 },
        notes: { movies: 'fine' },
        broadcaster: false,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.scores.movies).toBe(30);
        expect(result.value.broadcaster).toBe(false);
        expect(result.value.v).toBe(1);
      }
    });

    it('names the granularity when a score is off-step', () => {
      const result = validateResult({ scores: { movies: 37 } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('multiple of 10');
    });

    it('rejects an unknown scale rather than dropping it', () => {
      const result = validateResult({ scores: { interpretiveDance: 50 } });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain('interpretiveDance');
    });

    it.each([
      ['above range', 101],
      ['below range', -1],
      ['fractional', 42.5],
      ['a string', '50'],
      ['not a multiple of ten', 37],
    ])('rejects a score that is %s', (_label, value) => {
      expect(validateResult({ scores: { movies: value } }).ok).toBe(false);
    });

    it.each([0, 10, 50, 100])('accepts %i, which a slider can produce', (value) => {
      expect(validateResult({ scores: { movies: value } }).ok).toBe(true);
    });

    it('requires at least one rated scale', () => {
      expect(validateResult({ scores: {} }).ok).toBe(false);
    });

    it('rejects a note longer than 280 characters', () => {
      const result = validateResult({
        scores: { movies: 10 },
        notes: { movies: 'x'.repeat(281) },
      });
      expect(result.ok).toBe(false);
    });

    it('drops whitespace-only notes but keeps the result', () => {
      const result = validateResult({ scores: { movies: 10 }, notes: { movies: '   ' } });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.notes).toEqual({});
    });

    it('keeps a submitted name', () => {
      const result = validateResult({ scores: { movies: 30 }, name: '  Tyler  ' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Tyler');
    });

    it('flattens newlines and control characters in a name', () => {
      const result = validateResult({ scores: { movies: 30 }, name: 'Ty\nler\u0007 B' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBe('Ty ler B');
    });

    it('omits a name that is only whitespace', () => {
      const result = validateResult({ scores: { movies: 30 }, name: '   ' });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.name).toBeUndefined();
    });

    it('rejects a name longer than 40 characters', () => {
      const result = validateResult({ scores: { movies: 30 }, name: 'x'.repeat(41) });
      expect(result.ok).toBe(false);
    });

    it('rejects a non-string name', () => {
      expect(validateResult({ scores: { movies: 30 }, name: 42 }).ok).toBe(false);
    });

    it('rejects a note attached to a sub-scale', () => {
      const result = validateResult({
        scores: { books: 10 },
        notes: { 'books.fiction': 'nope' },
      });
      expect(result.ok).toBe(false);
    });
  });

  describe('generateId', () => {
    it('produces ids that pass the loader shape check', () => {
      for (let i = 0; i < 50; i += 1) {
        expect(isValidId(generateId())).toBe(true);
      }
    });

    it('rejects malformed ids', () => {
      expect(isValidId('short')).toBe(false);
      expect(isValidId('UPPERCASE1')).toBe(false);
      expect(isValidId('waytoolongforthis')).toBe(false);
    });
  });

  describe('action (save)', () => {
    it('stores a valid result and returns its id', async () => {
      const response = await action(postArgs({ scores: { movies: 30 } }));
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(isValidId(data.id)).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        `mediaProfile:result:${data.id}`,
        expect.any(String),
        'EX',
        expect.any(Number)
      );
    });

    it('rejects a non-POST method', async () => {
      const response = await action(
        createActionArgs('/api/mediaProfile/share', { method: 'PUT' })
      );
      expect(response.status).toBe(405);
    });

    it('rejects unparseable JSON', async () => {
      const response = await action(postArgs('{not json'));
      expect(response.status).toBe(400);
    });

    it('rejects an oversized body before parsing it', async () => {
      const response = await action(postArgs('x'.repeat(9000)));
      expect(response.status).toBe(413);
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('returns 429 once the per-IP window is exhausted', async () => {
      mockRedis.incr.mockResolvedValue(21);
      const response = await action(postArgs({ scores: { movies: 30 } }));
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeTruthy();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('reports a storage failure as 503 rather than a broken id', async () => {
      mockRedis.set.mockRejectedValue(new Error('redis down'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const response = await action(postArgs({ scores: { movies: 30 } }));
      expect(response.status).toBe(503);
    });
  });

  describe('loader (read)', () => {
    it('returns a stored result', async () => {
      const stored = { v: 1, scores: { movies: 30 }, notes: {}, savedAt: '2026-08-18T00:00:00.000Z' };
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));

      const response = await loader(createLoaderArgs('/api/mediaProfile/share?id=abcdefghij'));
      expect(response.status).toBe(200);
      expect((await response.json()).result).toEqual(stored);
    });

    it('refreshes the TTL on read so shared links stay alive', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ v: 1, scores: { movies: 10 }, notes: {} }));
      await loader(createLoaderArgs('/api/mediaProfile/share?id=abcdefghij'));
      expect(mockRedis.expire).toHaveBeenCalledWith(
        'mediaProfile:result:abcdefghij',
        expect.any(Number)
      );
    });

    it('rejects a malformed id without touching Redis', async () => {
      const response = await loader(createLoaderArgs('/api/mediaProfile/share?id=NOPE'));
      expect(response.status).toBe(400);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('404s an id that is not stored', async () => {
      mockRedis.get.mockResolvedValue(null);
      const response = await loader(createLoaderArgs('/api/mediaProfile/share?id=abcdefghij'));
      expect(response.status).toBe(404);
    });

    it('404s a payload that cannot be parsed', async () => {
      mockRedis.get.mockResolvedValue('{corrupt');
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const response = await loader(createLoaderArgs('/api/mediaProfile/share?id=abcdefghij'));
      expect(response.status).toBe(404);
    });
  });
});
