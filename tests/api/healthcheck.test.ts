/**
 * Tests for /healthcheck: it reports on Redis and fetches nothing, whatever
 * the request's Host headers say.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loader } from '~/routes/healthcheck';

const mockIsRedisAvailable = vi.fn();
vi.mock('~/utils/redis.server', () => ({
  isRedisAvailable: () => mockIsRedisAvailable(),
}));

describe('healthcheck loader', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockIsRedisAvailable.mockResolvedValue(true);
    global.fetch = vi.fn() as typeof fetch;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('is OK when Redis answers, without fetching anything', async () => {
    const response = await loader();
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns 503 when Redis is not ready', async () => {
    mockIsRedisAvailable.mockResolvedValue(false);
    expect((await loader()).status).toBe(503);
  });

  it('returns 500 when the check itself throws', async () => {
    mockIsRedisAvailable.mockRejectedValue(new Error('boom'));
    expect((await loader()).status).toBe(500);
  });

  it('is never cached', async () => {
    expect((await loader()).headers.get('Cache-Control')).toBe('no-store');
  });
});
