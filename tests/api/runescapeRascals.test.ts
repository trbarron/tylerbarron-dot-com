/**
 * Tests for the Runescape Rascals read-only API route.
 * The party's orchestrator (outside this site) writes the Redis keys; this route only reads.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loader as snapshotLoader } from '~/routes/api/runescapeRascals/snapshot';

const mockGet = vi.fn();
const mockGetBuffer = vi.fn();
vi.mock('~/utils/redis.server', () => ({
  getRedisClient: () => ({ get: mockGet, getBuffer: mockGetBuffer }),
}));

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
