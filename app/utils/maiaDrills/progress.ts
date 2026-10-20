// Drill progress, shared by every device: the server keeps each deck's
// completed card ids (api/maiaDrills/progress). A completion is sticky, so
// sessions on two devices can only add to each other's progress.
//
// Sends go through a local queue (loadPending/savePending): a completion made
// offline, or a send that fails, waits there and rides along with the next one.

import { loadPending, savePending } from './localStorage';

const URL = '/api/maiaDrills/progress';

/**
 * Mark cards completed, along with anything still queued. Resolves to every
 * completed id on the server, or null when it couldn't be reached (the cards
 * stay queued for next time).
 */
export async function sendCompleted(deckId: string, cardIds: string[] = []): Promise<string[] | null> {
  const ids = [...new Set([...loadPending(deckId), ...cardIds])];
  if (ids.length === 0) return null;
  savePending(deckId, ids);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deck: deckId, completed: ids }),
    });
    // A deck that's gone, or ids it refuses, will never succeed: stop retrying.
    if (res.status === 404 || res.status === 400 || res.status === 409) {
      savePending(deckId, []);
      return null;
    }
    if (!res.ok) return null;
    const data = (await res.json()) as { completed: string[] };
    // Only what this request carried: a completion queued meanwhile still needs sending.
    const sent = new Set(ids);
    savePending(
      deckId,
      loadPending(deckId).filter((id) => !sent.has(id)),
    );
    return data.completed;
  } catch {
    return null;
  }
}

/** The server's completed ids plus any still queued here: what this device should show. */
export function withPending(deckId: string, serverIds: Iterable<string>): Set<string> {
  return new Set([...serverIds, ...loadPending(deckId)]);
}

/** Every completed id on the server, or null when it couldn't be reached. */
export async function fetchCompleted(deckId: string): Promise<string[] | null> {
  try {
    const res = await fetch(`${URL}?deck=${encodeURIComponent(deckId)}`);
    if (!res.ok) return null;
    return ((await res.json()) as { completed: string[] }).completed;
  } catch {
    return null;
  }
}

/** Clear the deck's progress for everyone. True when the server did it. */
export async function resetCompleted(deckId: string): Promise<boolean> {
  savePending(deckId, []);
  try {
    const res = await fetch(`${URL}?deck=${encodeURIComponent(deckId)}`, { method: 'DELETE' });
    return res.ok;
  } catch {
    return false;
  }
}
