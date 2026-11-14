import Redis from 'ioredis';
import { randomBytes } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';
import { action, loader } from '~/routes/api/bookClub/poll';
import { RETENTION_SECONDS } from '~/utils/bookClub/types';
import { createActionArgs, createLoaderArgs } from '../setup';

const url = process.env.TEST_REDIS_URL;
const local = Boolean(url && /^redis:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/\d+)?$/.test(url));
if (url && !local) throw new Error('Book club tests require local Redis.');
const ref = vi.hoisted(() => ({ client: null as Redis | null }));
vi.mock('~/utils/redis.server', () => ({ getRedisClient: () => ref.client }));
vi.mock('~/utils/rateLimit.server', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
}));
const token = () => randomBytes(32).toString('hex');
const ids: string[] = [];
async function post(body: Record<string, unknown>, secret = '') {
  return action(
    createActionArgs('/api/bookClub/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
      body: JSON.stringify(body),
    }),
  );
}
async function read(id: string, secret = '') {
  const args = createLoaderArgs(`/api/bookClub/poll?id=${id}`);
  args.request = new Request(args.request, { headers: secret ? { Authorization: `Bearer ${secret}` } : {} });
  return loader(args);
}
async function create(settings: Record<string, unknown> = {}) {
  const res = await post({
    kind: 'create',
    title: 'November books',
    books: ['Book A', 'Book B', 'Book C', 'Book D'],
    ...settings,
  });
  expect(res.status).toBe(201);
  const data: { id: string; hostToken: string } = await res.json();
  ids.push(data.id);
  return data;
}
const ballot = { up: ['1', '2'], down: ['3'] };

describe.skipIf(!local)('Book club API with real Redis', () => {
  beforeAll(() => {
    ref.client = new Redis(url!, { maxRetriesPerRequest: 1 });
  });
  afterAll(async () => {
    if (ids.length) await ref.client!.del(...ids.map((id) => `bookClub:poll:${id}`));
    await ref.client!.quit();
  });
  it('creates, joins, locks, shows host progress, and reveals results only after closing', async () => {
    const { id, hostToken } = await create();
    const voter = token();
    expect(await ref.client!.ttl(`bookClub:poll:${id}`)).toBeGreaterThan(RETENTION_SECONDS - 5);
    const joined = await post({ kind: 'join', id, name: '  Alex  ' }, voter);
    expect((await joined.json()).self.name).toBe('Alex');
    const waiting = await (await read(id, hostToken)).json();
    expect(waiting.participants).toEqual([{ name: 'Alex', locked: false }]);
    expect(JSON.stringify(waiting)).not.toContain(hostToken);
    expect(JSON.stringify(waiting)).not.toContain(voter);
    expect((await read(id)).headers.get('Cache-Control')).toBe('no-store');
    expect((await read(id)).headers.get('X-Robots-Tag')).toContain('noindex');
    await ref.client!.expire(`bookClub:poll:${id}`, 60);
    const voted = await post({ kind: 'vote', id, ballot }, voter);
    expect(voted.status).toBe(200);
    expect((await voted.json()).self.ballot).toEqual(ballot);
    const host = await (await read(id, hostToken)).json();
    expect(host.participants).toEqual([{ name: 'Alex', locked: true }]);
    expect(host.results).toBeUndefined();
    const anonymous = await (await read(id)).json();
    expect(anonymous.self).toBeNull();
    expect(anonymous.results).toBeUndefined();
    expect(anonymous.participants).toBeUndefined();
    const ttl = await ref.client!.ttl(`bookClub:poll:${id}`);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
    expect((await post({ kind: 'close', id }, voter)).status).toBe(403);
    expect((await post({ kind: 'close', id }, hostToken)).status).toBe(200);
    const results = (await (await read(id)).json()).results;
    expect(results.map((b: { score: number }) => b.score)).toEqual([1, 1, 0, -1]);
    expect((await (await read(id, hostToken)).json()).results).toEqual(results);
    expect((await post({ kind: 'join', id, name: 'Late' }, token())).status).toBe(409);
    expect((await post({ kind: 'vote', id, ballot }, voter)).status).toBe(409);
  });
  it('preserves simultaneous joins and rejects duplicate names without impersonation', async () => {
    const { id, hostToken } = await create();
    const a = token(),
      b = token();
    const joins = await Promise.all([
      post({ kind: 'join', id, name: 'Ada' }, a),
      post({ kind: 'join', id, name: 'Ben' }, b),
    ]);
    expect(joins.map((r) => r.status)).toEqual([200, 200]);
    expect((await post({ kind: 'join', id, name: 'ADA' }, token())).status).toBe(409);
    expect((await post({ kind: 'join', id, name: 'Ada' }, a)).status).toBe(200);
    expect((await (await read(id, hostToken)).json()).participants).toHaveLength(2);
    expect((await post({ kind: 'vote', id, ballot }, token())).status).toBe(403);
  });
  it('accepts exactly one competing final ballot and never allows an edit', async () => {
    const { id } = await create();
    const voter = token();
    await post({ kind: 'join', id, name: 'Cy' }, voter);
    const other = { up: ['2', '3'], down: ['4'] };
    const responses = await Promise.all([
      post({ kind: 'vote', id, ballot }, voter),
      post({ kind: 'vote', id, ballot: other }, voter),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const saved = (await (await read(id, voter)).json()).self.ballot;
    expect([ballot, other]).toContainEqual(saved);
    expect((await post({ kind: 'vote', id, ballot }, voter)).status).toBe(409);
    expect((await (await read(id, voter)).json()).self.ballot).toEqual(saved);
  });
  it('rejects illegal ballots and malformed lists without changing progress', async () => {
    expect((await post({ kind: 'create', title: 'Test', books: ['A', 'B'] })).status).toBe(400);
    expect((await post({ kind: 'create', title: 'Test', books: ['A', 'a', 'C'] })).status).toBe(400);
    const { id, hostToken } = await create();
    const voter = token();
    await post({ kind: 'join', id, name: 'Di' }, voter);
    for (const invalid of [
      { up: ['1', '1'], down: ['2'] },
      { up: ['1', '2'], down: ['2'] },
      { up: ['1', '2'], down: ['99'] },
    ])
      expect((await post({ kind: 'vote', id, ballot: invalid }, voter)).status).toBe(400);
    expect((await (await read(id, hostToken)).json()).participants[0].locked).toBe(false);
  });
  it('enforces configured maxima, counts repeated votes, and rejects opposing votes on one book', async () => {
    const { id, hostToken } = await create({ upVotes: 4, downVotes: 2, allowMultipleVotes: true });
    const voter = token();
    await post({ kind: 'join', id, name: 'Multi' }, voter);
    const view = await (await read(id, voter)).json();
    expect([view.upVotes, view.downVotes, view.allowMultipleVotes]).toEqual([4, 2, true]);
    for (const invalid of [
      { up: ['1', '1', '1', '1', '1'], down: [] },
      { up: [], down: ['2', '2', '2'] },
      { up: ['1'], down: ['1'] },
    ])
      expect((await post({ kind: 'vote', id, ballot: invalid }, voter)).status).toBe(400);
    const partial = { up: ['1', '1', '1'], down: ['2', '2'] };
    expect((await post({ kind: 'vote', id, ballot: partial }, voter)).status).toBe(200);
    expect((await (await read(id, voter)).json()).self.ballot).toEqual(partial);
    await post({ kind: 'close', id }, hostToken);
    const results = (await (await read(id)).json()).results;
    expect(results.find((b: { id: string }) => b.id === '1')).toMatchObject({ up: 3, down: 0, score: 3 });
    expect(results.find((b: { id: string }) => b.id === '2')).toMatchObject({ up: 0, down: 2, score: -2 });
  });
  it('accepts partial and empty ballots as final, including a zero-vote column', async () => {
    const { id, hostToken } = await create({ upVotes: 1, downVotes: 0 });
    for (const [name, selection] of [
      ['Partial', { up: ['1'], down: [] }],
      ['Abstain', { up: [], down: [] }],
    ] as const) {
      const voter = token();
      await post({ kind: 'join', id, name }, voter);
      const submitted = await post({ kind: 'vote', id, ballot: selection }, voter);
      expect(submitted.status).toBe(200);
      expect((await submitted.json()).self.ballot).toEqual(selection);
      expect((await post({ kind: 'vote', id, ballot: selection }, voter)).status).toBe(409);
    }
    expect((await (await read(id, hostToken)).json()).participants.every((v: { locked: boolean }) => v.locked)).toBe(
      true,
    );
  });
  it('keeps old poll defaults and reads stored single-downvote ballots', async () => {
    const { id } = await create();
    const voter = token();
    await post({ kind: 'join', id, name: 'Legacy' }, voter);
    const raw = JSON.parse((await ref.client!.get(`bookClub:poll:${id}`))!);
    delete raw.upVotes;
    delete raw.downVotes;
    delete raw.allowMultipleVotes;
    Object.values(raw.voters).forEach((v) => {
      (v as { ballot: unknown }).ballot = { up: ['1', '2'], down: '3' };
    });
    await ref.client!.set(`bookClub:poll:${id}`, JSON.stringify(raw), 'KEEPTTL');
    const restored = await (await read(id, voter)).json();
    expect([restored.upVotes, restored.downVotes, restored.allowMultipleVotes]).toEqual([2, 1, false]);
    expect(restored.self.ballot).toEqual({ up: ['1', '2'], down: ['3'] });
  });
  it('accepts the previous client payload without allowing duplicate default votes', async () => {
    const { id } = await create();
    const voter = token();
    await post({ kind: 'join', id, name: 'Old tab' }, voter);
    expect((await post({ kind: 'vote', id, ballot: { up: ['1', '1'], down: '3' } }, voter)).status).toBe(400);
    const res = await post({ kind: 'vote', id, ballot: { up: ['1', '2'], down: '3' } }, voter);
    expect(res.status).toBe(200);
    expect((await res.json()).self.ballot).toEqual({ up: ['1', '2'], down: ['3'] });
  });
  it('rejects invalid creation allowances', async () => {
    for (const settings of [
      { upVotes: -1 },
      { downVotes: 31 },
      { upVotes: 1.5 },
      { upVotes: '2' },
      { upVotes: 0, downVotes: 0 },
      { allowMultipleVotes: 'yes' },
    ]) {
      expect((await post({ kind: 'create', title: 'Invalid', books: ['A', 'B', 'C'], ...settings })).status).toBe(400);
    }
  });
  it('expires the whole room and refuses to recreate it by joining or voting', async () => {
    const { id } = await create();
    await ref.client!.expire(`bookClub:poll:${id}`, 0);
    expect((await read(id)).status).toBe(404);
    expect((await post({ kind: 'join', id, name: 'Too late' }, token())).status).toBe(404);
    expect((await post({ kind: 'vote', id, ballot }, token())).status).toBe(404);
    expect(await ref.client!.exists(`bookClub:poll:${id}`)).toBe(0);
  });
});
