import { useEffect, useRef, useState } from 'react';
import { usePolling } from '~/hooks/usePolling';
import type { PollView } from '~/utils/bookClub/types';

export async function bookRequest(body: Record<string, unknown>, token = '') {
  const res = await fetch('/api/bookClub/poll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Could not save. Please try again.');
  return data;
}
export function useBookClub(id: string, host: boolean) {
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [poll, setPoll] = useState<PollView | null>(null);
  const [error, setError] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const [busy, setBusy] = useState(false);
  const revision = useRef(0);
  useEffect(() => {
    setReady(false);
    setPoll(null);
    try {
      const storageKey = `bookClub:${host ? 'host' : 'voter'}:${id}`;
      const fromLink = host ? new URLSearchParams(window.location.hash.slice(1)).get('host') : null;
      let saved = fromLink || localStorage.getItem(storageKey) || '';
      if (!saved && !host)
        saved = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');
      if (saved) localStorage.setItem(storageKey, saved);
      if (fromLink) window.history.replaceState(null, '', window.location.pathname);
      setToken(saved);
      setReady(true);
    } catch {
      setError('Please allow browser storage to keep your host link or voter session, then reload.');
    }
  }, [id, host]);
  usePolling(
    async () => {
      const current = revision.current;
      try {
        const res = await fetch(`/api/bookClub/poll?id=${encodeURIComponent(id)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });
        const data = await res.json();
        if (current !== revision.current) return;
        if (!res.ok) {
          if (res.status === 404) setPoll(null);
          throw new Error(data.error ?? 'Could not load this vote.');
        }
        if (host && !data.host) throw new Error('Open the private host link you saved when creating this vote.');
        setPoll(data);
        setRefreshError('');
      } catch (err) {
        if (current === revision.current) setRefreshError(err instanceof Error ? err.message : 'Could not refresh.');
      }
    },
    ready ? 5000 : null,
  );
  async function act(body: Record<string, unknown>) {
    revision.current += 1;
    setBusy(true);
    setError('');
    try {
      setPoll(await bookRequest({ ...body, id }, token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      revision.current += 1;
      setBusy(false);
    }
  }
  return { poll, token, error: error || refreshError, busy, act };
}
