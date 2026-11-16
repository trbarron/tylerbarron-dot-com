import { describe, it, expect, vi, beforeEach } from 'vitest';
import { action, loader } from '~/routes/api/bookClub/poll';
import { checkRateLimit } from '~/utils/rateLimit.server';
import { isBookClubPath } from '~/utils/bookClub/types';
import { createActionArgs, createLoaderArgs } from '../setup';
const db = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), eval: vi.fn() }));
vi.mock('~/utils/redis.server', () => ({ getRedisClient: () => db }));
vi.mock('~/utils/rateLimit.server', () => ({ checkRateLimit: vi.fn() }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(checkRateLimit).mockResolvedValue({ allowed: true, retryAfter: 0 });
});
const request = (body: unknown) =>
  action(
    createActionArgs('/api/bookClub/poll', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
describe('Book club request boundaries', () => {
  it('recognizes private book-club paths including route case and encoded variants', () => {
    for (const path of ['/book-club', '/Book-Club/room/host', '/%62ook-club/room'])
      expect(isBookClubPath(path)).toBe(true);
    for (const path of ['/', '/blog/book-club', '/book-club-other', '/%xx']) expect(isBookClubPath(path)).toBe(false);
  });
  it('does not write or consume a quota for malformed input', async () => {
    for (const body of [null, [], { kind: 'no' }, { kind: 'create', title: '', books: ['a', 'b', 'c'] }])
      expect((await request(body)).status).toBeGreaterThanOrEqual(400);
    expect(db.set).not.toHaveBeenCalled();
    expect(db.eval).not.toHaveBeenCalled();
    expect(checkRateLimit).not.toHaveBeenCalled();
  });
  it('returns Retry-After and no Redis writes when create is rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue({ allowed: false, retryAfter: 3600 });
    const res = await request({ kind: 'create', title: 'Club', books: ['a', 'b', 'c'] });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('3600');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(db.set).not.toHaveBeenCalled();
  });
  it('rejects oversized bodies and unsupported methods', async () => {
    expect((await request({ books: 'a'.repeat(16001) })).status).toBe(413);
    expect((await action(createActionArgs('/api/bookClub/poll', { method: 'DELETE' }))).status).toBe(405);
  });
  it('rejects malformed ids without querying Redis', async () => {
    expect((await loader(createLoaderArgs('/api/bookClub/poll?id=bad'))).status).toBe(404);
    expect(db.get).not.toHaveBeenCalled();
  });
  it('returns a recoverable unavailable response on Redis failure', async () => {
    db.set.mockRejectedValueOnce(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    expect((await request({ kind: 'create', title: 'Club', books: ['a', 'b', 'c'] })).status).toBe(503);
  });
});
