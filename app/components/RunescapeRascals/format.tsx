import { useEffect, useState } from 'react';

/**
 * "Now", but only once mounted: the server renders with the snapshot's own time so the
 * HTML matches what the browser hydrates, then the clock takes over.
 */
export function useNow(fallback: number): { now: number; mounted: boolean } {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  return { now: now ?? fallback, mounted: now !== null };
}

export function ago(t: number, now: number): string {
  if (!t) return 'never';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 90) return `${s}s ago`;
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

/** 24-hour local time. Render only once mounted: the server's timezone is not the reader's. */
export function clock(t: number): string {
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

export const pct = (x: number | null | undefined) => `${Math.round((x ?? 0) * 100)}%`;
