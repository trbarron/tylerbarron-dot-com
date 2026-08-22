/**
 * Tests for /api/mediaProfile/share and /api/mediaProfile/public
 * Covers payload validation, id round-tripping, edit-token authorisation,
 * the public index, and the failure responses.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { createActionArgs, createLoaderArgs } from '../setup';
import { action, loader } from '~/routes/api/mediaProfile/share';
import { loader as publicLoader } from '~/routes/api/mediaProfile/public';
import {
  generateEditToken,
  generateId,
  isValidEditToken,
  isValidId,
  validateResult,
} from '~/utils/mediaProfile/share.server';

/**
 * `multi()` and `pipeline()` return a chainable builder; every command on it
 * returns the builder itself and `exec()` resolves. Recording the calls in
 * order lets a test assert what a write actually did.
 */
function createChain(record: unknown[][]) {
  const chain: Record<string, unknown> = {
    exec: vi.fn().mockResolvedValue([]),
  };
  for (const command of ['set', 'expire', 'zadd', 'zremrangebyrank']) {
    chain[command] = vi.fn((...args: unknown[]) => {
      record.push([command, ...args]);
      return chain;
    });
  }
  return chain;
}

const multiCalls: unknown[][] = [];
const pipelineCalls: unknown[][] = [];

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  mget: vi.fn(),
  expire: vi.fn(),
  incr: vi.fn(),
  zadd: vi.fn(),
  zrem: vi.fn(),
  zrevrange: vi.fn(),
  multi: vi.fn(() => createChain(multiCalls)),
  pipeline: vi.fn(() => createChain(pipelineCalls)),
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

function putArgs(body: unknown) {
  return createActionArgs('/api/mediaProfile/share', {
    method: 'PUT',
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

/** What the write for `command` recorded, or undefined if it never ran. */
function recorded(record: unknown[][], command: string, keyPart: string) {
  return record.find(
    ([name, key]) => name === command && typeof key === 'string' && key.includes(keyPart)
  );
}

describe('Media Profile share API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    multiCalls.length = 0;
    pipelineCalls.length = 0;
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.zrem.mockResolvedValue(1);
    mockRedis.zadd.mockResolvedValue(1);
    mockRedis.zrevrange.mockResolvedValue([]);
    mockRedis.mget.mockResolvedValue([]);
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
      const result = validateResult({ scores: { movies: 30 }, name: 'Ty\nler B' });
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

    it('keeps an explicit opt-in to the public list', () => {
      const result = validateResult({ scores: { movies: 30 }, isPublic: true });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.isPublic).toBe(true);
    });

    it('leaves isPublic off when it was not asked for', () => {
      const result = validateResult({ scores: { movies: 30 }, isPublic: false });
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.isPublic).toBeUndefined();
    });

    it('rejects a non-boolean isPublic', () => {
      expect(validateResult({ scores: { movies: 30 }, isPublic: 'yes' }).ok).toBe(false);
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

  describe('generateEditToken', () => {
    it('produces tokens that pass the shape check', () => {
      for (let i = 0; i < 50; i += 1) {
        expect(isValidEditToken(generateEditToken())).toBe(true);
      }
    });

    it('does not repeat itself', () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateEditToken()));
      expect(tokens.size).toBe(100);
    });

    it('rejects a token that is too short or not URL-safe', () => {
      expect(isValidEditToken('tiny')).toBe(false);
      expect(isValidEditToken(`${'a'.repeat(20)}!`)).toBe(false);
      expect(isValidEditToken('a'.repeat(200))).toBe(false);
    });
  });

  describe('action (save)', () => {
    it('stores a valid result and returns its id and edit token', async () => {
      const response = await action(postArgs({ scores: { movies: 30 } }));
      expect(response.status).toBe(201);

      const data = await response.json();
      expect(isValidId(data.id)).toBe(true);
      expect(isValidEditToken(data.editToken)).toBe(true);

      expect(recorded(multiCalls, 'set', `mediaProfile:result:${data.id}`)).toBeTruthy();
    });

    it('stores the edit token hashed, never in the clear', async () => {
      const response = await action(postArgs({ scores: { movies: 30 } }));
      const { id, editToken } = await response.json();

      const write = recorded(multiCalls, 'set', `mediaProfile:edit:${id}`);
      expect(write?.[2]).toBe(createHash('sha256').update(editToken).digest('hex'));
      expect(write?.[2]).not.toBe(editToken);
    });

    it('gives cards a two-year window', async () => {
      const response = await action(postArgs({ scores: { movies: 30 } }));
      const { id } = await response.json();
      const write = recorded(multiCalls, 'set', `mediaProfile:result:${id}`);
      expect(write?.[4]).toBe(2 * 365 * 24 * 60 * 60);
    });

    it('adds a public card to the index', async () => {
      const response = await action(postArgs({ scores: { movies: 30 }, isPublic: true }));
      const { id } = await response.json();
      expect(recorded(multiCalls, 'zadd', 'mediaProfile:public')).toContain(id);
    });

    it('leaves a private card out of the index', async () => {
      await action(postArgs({ scores: { movies: 30 } }));
      expect(recorded(multiCalls, 'zadd', 'mediaProfile:public')).toBeUndefined();
    });

    it('rejects a non-POST, non-PUT method', async () => {
      const response = await action(
        createActionArgs('/api/mediaProfile/share', { method: 'DELETE' })
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
      expect(multiCalls).toHaveLength(0);
    });

    it('returns 429 once the per-IP window is exhausted', async () => {
      mockRedis.incr.mockResolvedValue(21);
      const response = await action(postArgs({ scores: { movies: 30 } }));
      expect(response.status).toBe(429);
      expect(response.headers.get('Retry-After')).toBeTruthy();
      expect(multiCalls).toHaveLength(0);
    });

    it('reports a storage failure as 503 rather than a broken id', async () => {
      mockRedis.multi.mockImplementationOnce(() => ({
        set: vi.fn().mockReturnThis(),
        exec: vi.fn().mockRejectedValue(new Error('redis down')),
      }));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const response = await action(postArgs({ scores: { movies: 30 } }));
      expect(response.status).toBe(503);
    });
  });

  describe('action (edit)', () => {
    const id = 'abcdefghij';
    const token = 'a'.repeat(32);
    const hash = createHash('sha256').update(token).digest('hex');
    const existing = JSON.stringify({
      v: 1,
      scores: { movies: 30 },
      notes: {},
      savedAt: '2026-08-18T00:00:00.000Z',
    });

    function mockStored({ storedHash = hash, payload = existing } = {}) {
      mockRedis.get.mockImplementation((key: string) =>
        Promise.resolve(key.startsWith('mediaProfile:edit:') ? storedHash : payload)
      );
    }

    it('replaces a card when the edit token matches', async () => {
      mockStored();
      const response = await action(
        putArgs({ id, editToken: token, scores: { movies: 90 } })
      );
      expect(response.status).toBe(200);

      const write = recorded(multiCalls, 'set', `mediaProfile:result:${id}`);
      const stored = JSON.parse(String(write?.[2]));
      expect(stored.scores.movies).toBe(90);
    });

    it('keeps the original creation date and stamps the edit', async () => {
      mockStored();
      await action(putArgs({ id, editToken: token, scores: { movies: 90 } }));

      const write = recorded(multiCalls, 'set', `mediaProfile:result:${id}`);
      const stored = JSON.parse(String(write?.[2]));
      expect(stored.savedAt).toBe('2026-08-18T00:00:00.000Z');
      expect(typeof stored.updatedAt).toBe('string');
    });

    it('refuses an edit token that does not match, without writing', async () => {
      mockStored();
      const response = await action(
        putArgs({ id, editToken: 'b'.repeat(32), scores: { movies: 90 } })
      );
      expect(response.status).toBe(403);
      expect(recorded(multiCalls, 'set', `mediaProfile:result:${id}`)).toBeUndefined();
    });

    it('refuses an edit with no token at all', async () => {
      mockStored();
      const response = await action(putArgs({ id, scores: { movies: 90 } }));
      expect(response.status).toBe(403);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('rejects a malformed id before reading anything', async () => {
      const response = await action(
        putArgs({ id: 'NOPE', editToken: token, scores: { movies: 90 } })
      );
      expect(response.status).toBe(400);
      expect(mockRedis.get).not.toHaveBeenCalled();
    });

    it('404s a card that has expired', async () => {
      mockRedis.get.mockResolvedValue(null);
      const response = await action(
        putArgs({ id, editToken: token, scores: { movies: 90 } })
      );
      expect(response.status).toBe(404);
    });

    it('still validates the payload of an authorised edit', async () => {
      mockStored();
      const response = await action(
        putArgs({ id, editToken: token, scores: { movies: 37 } })
      );
      expect(response.status).toBe(400);
    });

    it('publishes a card that the edit opted in', async () => {
      mockStored();
      await action(putArgs({ id, editToken: token, scores: { movies: 30 }, isPublic: true }));
      expect(recorded(multiCalls, 'zadd', 'mediaProfile:public')).toContain(id);
    });

    it('withdraws a card that the edit opted out', async () => {
      mockStored({ payload: JSON.stringify({ v: 1, scores: { movies: 30 }, notes: {}, isPublic: true, savedAt: '2026-08-18T00:00:00.000Z' }) });
      await action(putArgs({ id, editToken: token, scores: { movies: 30 }, isPublic: false }));
      expect(mockRedis.zrem).toHaveBeenCalledWith('mediaProfile:public', id);
    });

    it('returns 429 once the per-IP edit window is exhausted', async () => {
      mockRedis.incr.mockResolvedValue(31);
      const response = await action(
        putArgs({ id, editToken: token, scores: { movies: 90 } })
      );
      expect(response.status).toBe(429);
      expect(mockRedis.get).not.toHaveBeenCalled();
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

    it('never hands the edit token hash back to a reader', async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ v: 1, scores: { movies: 30 }, notes: {}, savedAt: '2026-08-18T00:00:00.000Z' })
      );
      const response = await loader(createLoaderArgs('/api/mediaProfile/share?id=abcdefghij'));
      const body = JSON.stringify(await response.json());
      expect(body).not.toContain('editToken');
      expect(body).not.toContain('editHash');
      // The loader only ever reads the result key.
      expect(mockRedis.get).toHaveBeenCalledWith('mediaProfile:result:abcdefghij');
      expect(mockRedis.get).not.toHaveBeenCalledWith('mediaProfile:edit:abcdefghij');
    });

    it('refreshes the TTL on read so shared links stay alive', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ v: 1, scores: { movies: 10 }, notes: {} }));
      await loader(createLoaderArgs('/api/mediaProfile/share?id=abcdefghij'));
      expect(recorded(pipelineCalls, 'expire', 'mediaProfile:result:abcdefghij')).toBeTruthy();
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

  describe('public listing', () => {
    const card = (name: string, isPublic = true) =>
      JSON.stringify({
        v: 1,
        name,
        scores: { movies: 30 },
        notes: {},
        isPublic,
        savedAt: '2026-08-18T00:00:00.000Z',
      });

    it('returns published cards newest first, as the index orders them', async () => {
      mockRedis.zrevrange.mockResolvedValue(['bbbbbbbbbb', 'aaaaaaaaaa']);
      mockRedis.mget.mockResolvedValue([card('Newer'), card('Older')]);

      const response = await publicLoader(createLoaderArgs('/api/mediaProfile/public'));
      expect(response.status).toBe(200);

      const { cards } = await response.json();
      expect(cards.map((c: { id: string }) => c.id)).toEqual(['bbbbbbbbbb', 'aaaaaaaaaa']);
      expect(cards[0].result.name).toBe('Newer');
    });

    it('returns an empty list rather than failing when nobody has published', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);
      const response = await publicLoader(createLoaderArgs('/api/mediaProfile/public'));
      expect((await response.json()).cards).toEqual([]);
      expect(mockRedis.mget).not.toHaveBeenCalled();
    });

    it('drops an expired id from the index instead of rendering a hole', async () => {
      mockRedis.zrevrange.mockResolvedValue(['aaaaaaaaaa', 'bbbbbbbbbb']);
      mockRedis.mget.mockResolvedValue([null, card('Still here')]);

      const { cards } = await (
        await publicLoader(createLoaderArgs('/api/mediaProfile/public'))
      ).json();
      expect(cards).toHaveLength(1);
      expect(mockRedis.zrem).toHaveBeenCalledWith('mediaProfile:public', 'aaaaaaaaaa');
    });

    it('hides a card whose payload says it is no longer public', async () => {
      mockRedis.zrevrange.mockResolvedValue(['aaaaaaaaaa']);
      mockRedis.mget.mockResolvedValue([card('Withdrawn', false)]);

      const { cards } = await (
        await publicLoader(createLoaderArgs('/api/mediaProfile/public'))
      ).json();
      expect(cards).toEqual([]);
      expect(mockRedis.zrem).toHaveBeenCalledWith('mediaProfile:public', 'aaaaaaaaaa');
    });

    it('caps how many cards one request can ask for', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);
      await publicLoader(createLoaderArgs('/api/mediaProfile/public?limit=5000'));
      expect(mockRedis.zrevrange).toHaveBeenCalledWith('mediaProfile:public', 0, 49);
    });

    it('ignores a nonsense limit', async () => {
      mockRedis.zrevrange.mockResolvedValue([]);
      await publicLoader(createLoaderArgs('/api/mediaProfile/public?limit=-3'));
      expect(mockRedis.zrevrange).toHaveBeenCalledWith('mediaProfile:public', 0, 24);
    });

    it('returns 429 once the per-IP window is exhausted', async () => {
      mockRedis.incr.mockResolvedValue(61);
      const response = await publicLoader(createLoaderArgs('/api/mediaProfile/public'));
      expect(response.status).toBe(429);
      expect(mockRedis.zrevrange).not.toHaveBeenCalled();
    });

    it('reports a Redis failure as 503', async () => {
      mockRedis.zrevrange.mockRejectedValue(new Error('redis down'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const response = await publicLoader(createLoaderArgs('/api/mediaProfile/public'));
      expect(response.status).toBe(503);
    });
  });
});
