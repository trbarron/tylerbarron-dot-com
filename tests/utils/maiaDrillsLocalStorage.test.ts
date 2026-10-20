/**
 * Drill progress lives on the server; the browser only queues completions it
 * hasn't sent yet (localStorage) and sends them (progress.ts).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadPending, savePending } from '~/utils/maiaDrills/localStorage';
import { sendCompleted, withPending } from '~/utils/maiaDrills/progress';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

/** Progress as this browser kept it before it moved to the server. */
const legacy = (deckId: string, progress: Record<string, { last: 'correct' | 'wrong' }>) =>
  store.set(`maiaDrills:progress:${deckId}`, JSON.stringify(progress));

describe('the pending queue', () => {
  it('is empty for a deck never drilled here', () => {
    expect(loadPending('deck1')).toEqual([]);
  });

  it('includes cards solved back when progress was kept in the browser, once', () => {
    legacy('deck1', { a: { last: 'correct' }, b: { last: 'wrong' }, c: { last: 'correct' } });
    expect(loadPending('deck1').sort()).toEqual(['a', 'c']);
    savePending('deck1', []);
    expect(loadPending('deck1')).toEqual([]);
    expect(store.has('maiaDrills:progress:deck1')).toBe(false);
  });

  it('merges queued and legacy cards without duplicates', () => {
    legacy('deck1', { a: { last: 'correct' } });
    store.set('maiaDrills:pending:deck1', JSON.stringify(['a', 'b']));
    expect(loadPending('deck1').sort()).toEqual(['a', 'b']);
  });

  it('shows the server’s cards plus the ones still queued', () => {
    savePending('deck1', ['q']);
    expect([...withPending('deck1', ['s'])].sort()).toEqual(['q', 's']);
  });
});

describe('sendCompleted', () => {
  const respond = (status: number, body: unknown) =>
    vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

  it('sends the card with anything queued, then clears the queue', async () => {
    legacy('deck1', { old: { last: 'correct' } });
    const fetchMock = respond(200, { completed: ['old', 'new', 'other-device'] });
    vi.stubGlobal('fetch', fetchMock);

    expect(await sendCompleted('deck1', ['new'])).toEqual(['old', 'new', 'other-device']);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ deck: 'deck1', completed: ['old', 'new'] });
    expect(loadPending('deck1')).toEqual([]);
  });

  it('keeps the card queued when the server can’t be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await sendCompleted('deck1', ['a'])).toBeNull();
    expect(loadPending('deck1')).toEqual(['a']);

    vi.stubGlobal('fetch', respond(503, { error: 'down' }));
    expect(await sendCompleted('deck1', ['b'])).toBeNull();
    expect(loadPending('deck1').sort()).toEqual(['a', 'b']);
  });

  it('drops the queue for a deck that’s gone, so it stops retrying', async () => {
    vi.stubGlobal('fetch', respond(404, { error: 'gone' }));
    expect(await sendCompleted('deck1', ['a'])).toBeNull();
    expect(loadPending('deck1')).toEqual([]);
  });

  it('keeps a card queued while a send was in flight', async () => {
    let finish!: (value: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((resolve) => (finish = resolve))),
    );
    const first = sendCompleted('deck1', ['a']);
    // Answered meanwhile, and its own send hasn't happened yet.
    savePending('deck1', [...loadPending('deck1'), 'b']);
    finish({ ok: true, status: 200, json: async () => ({ completed: ['a'] }) });
    await first;
    expect(loadPending('deck1')).toEqual(['b']);
  });

  it('does nothing when there is nothing to send', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendCompleted('deck1')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
