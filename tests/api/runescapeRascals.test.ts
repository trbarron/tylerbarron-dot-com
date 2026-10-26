/**
 * Tests for the Runescape Rascals read-only API routes.
 * The party's orchestrator (outside this site) writes the Redis keys; these routes only read.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { LoaderFunctionArgs } from 'react-router';
import { loader as snapshotLoader } from '~/routes/api/runescapeRascals/snapshot';
import { loader as portraitLoader } from '~/routes/api/runescapeRascals/portrait';
import { loader as shotLoader } from '~/routes/api/runescapeRascals/shot';

const mockGet = vi.fn();
const mockGetBuffer = vi.fn();
vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => ({ get: mockGet, getBuffer: mockGetBuffer }),
}));

const shotArgs = (name: string) =>
  ({
    request: new Request(`https://example.com/api/runescapeRascals/shot/${name}`),
    params: { name },
    context: {},
  }) as unknown as LoaderFunctionArgs;

describe('GET /api/runescapeRascals/snapshot', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the published snapshot with a short cache', async () => {
    mockGet.mockResolvedValue(JSON.stringify({ generatedAt: 1, partyTotal: 120, bots: [] }));
    const res = await snapshotLoader();
    expect(mockGet).toHaveBeenCalledWith('runescapeRascals:snapshot');
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age=10');
    expect(await res.json()).toEqual({ snapshot: { generatedAt: 1, partyTotal: 120, bots: [] } });
  });

  it('returns a null snapshot when the party has not published', async () => {
    mockGet.mockResolvedValue(null);
    const res = await snapshotLoader();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ snapshot: null });
  });

  it('returns 500 when Redis fails', async () => {
    mockGet.mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await snapshotLoader();
    expect(res.status).toBe(500);
  });
});

describe('GET /api/runescapeRascals/shot/:name', () => {
  beforeEach(() => vi.clearAllMocks());

  it('serves the JPEG for a party member', async () => {
    mockGetBuffer.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff]));
    const res = await shotLoader(shotArgs('bram'));
    expect(mockGetBuffer).toHaveBeenCalledWith('runescapeRascals:shot:bram');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xd8, 0xff]));
  });

  it('rejects names outside the party without touching Redis', async () => {
    const res = await shotLoader(shotArgs('../snapshot'));
    expect(res.status).toBe(404);
    expect(mockGetBuffer).not.toHaveBeenCalled();
  });

  it('returns 404 when there is no screenshot yet', async () => {
    mockGetBuffer.mockResolvedValue(null);
    const res = await shotLoader(shotArgs('wren'));
    expect(res.status).toBe(404);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});

const portraitArgs = (name: string, kind: string) =>
  ({ ...shotArgs(name), params: { name, kind } }) as unknown as LoaderFunctionArgs;
describe('GET /api/runescapeRascals/portrait/:name/:kind', () => {
  beforeEach(() => vi.clearAllMocks());
  it('serves head and body PNG bytes under the expected Redis keys', async () => {
    mockGetBuffer.mockResolvedValue(Buffer.from([137, 80, 78, 71]));
    for (const kind of ['head', 'body']) {
      const response = await portraitLoader(portraitArgs('trish', kind));
      expect(mockGetBuffer).toHaveBeenLastCalledWith(`runescapeRascals:portrait:trish:${kind}`);
      expect(response.headers.get('Content-Type')).toBe('image/png');
      expect(response.headers.get('Cache-Control')).toContain('max-age=300');
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
    }
  });
  it('rejects invalid names and portrait kinds before Redis access', async () => {
    expect((await portraitLoader(portraitArgs('../snapshot', 'head'))).status).toBe(404);
    expect((await portraitLoader(portraitArgs('trish', 'other'))).status).toBe(404);
    expect(mockGetBuffer).not.toHaveBeenCalled();
  });
  it('does not cache a missing portrait, allowing a subsequent publication to appear', async () => {
    mockGetBuffer.mockResolvedValue(null);
    const response = await portraitLoader(portraitArgs('wren', 'head'));
    expect(response.status).toBe(404);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});
