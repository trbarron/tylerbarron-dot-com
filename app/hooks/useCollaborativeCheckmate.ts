import { useCallback, useEffect, useRef, useState } from 'react';
import { usePolling } from '~/hooks/usePolling';
import { POLL_MS, type PlayerAction, type PublicGame } from '~/utils/collaborativeCheckmate/types';

const API = '/api/collaborativeCheckmate';

export interface LocalError {
  at: number;
  message: string;
}

/**
 * A Collaborative Checkmate game as this player sees it: joins once, then polls
 * every POLL_MS (also while the tab is hidden, so the seat stays held) and
 * sends the player's actions. Responses can arrive out of order, so only the
 * newest request's state is kept.
 */
export function useCollaborativeCheckmate(gameId: string, playerId: string, isPrivate: boolean) {
  const [game, setGame] = useState<PublicGame | null>(null);
  const [connected, setConnected] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [errors, setErrors] = useState<LocalError[]>([]);
  /** Local time minus server time, from the latest response; turns the server's deadline into a countdown. */
  const [clockOffset, setClockOffset] = useState(0);
  const sent = useRef(0);
  const applied = useRef(0);

  const addError = useCallback((message: string) => setErrors((e) => [...e, { at: Date.now(), message }]), []);

  const request = useCallback(
    async (path: string, init?: RequestInit): Promise<{ game?: PublicGame; error?: string; status: number }> => {
      const seq = ++sent.current;
      const res = await fetch(`${API}/${path}`, init);
      const body = await res.json().catch(() => ({}));
      const state: PublicGame | undefined = path.startsWith('action') ? body.game : res.ok ? body : undefined;
      if (state && seq > applied.current) {
        applied.current = seq;
        setGame(state);
        setClockOffset(Date.now() - state.serverNow);
      }
      return { game: state, error: body.error, status: res.status };
    },
    [],
  );

  const post = useCallback(
    (path: string, body: object) =>
      request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    [request],
  );

  const [joined, setJoined] = useState(false);
  useEffect(() => {
    let cancelled = false;
    post('join', { gameId, playerId, isPrivate })
      .then((r) => {
        if (cancelled) return;
        if (r.game) setJoined(true);
        else addError(r.error ?? 'Could not join the game.');
      })
      .catch(() => !cancelled && addError('Could not reach the server.'));
    return () => {
      cancelled = true;
    };
  }, [gameId, playerId, isPrivate, post, addError]);

  usePolling(
    async () => {
      try {
        const r = await request(`state?gameId=${encodeURIComponent(gameId)}&playerId=${encodeURIComponent(playerId)}`);
        setConnected(r.status === 200);
        setNotFound(r.status === 404);
      } catch {
        setConnected(false);
      }
    },
    joined ? POLL_MS : null,
    { whileHidden: true },
  );

  const send = useCallback(
    async (action: PlayerAction) => {
      try {
        const r = await post('action', { gameId, playerId, action });
        if (r.error) addError(r.error);
      } catch {
        addError('Could not reach the server.');
      }
    },
    [gameId, playerId, post, addError],
  );

  return { game, connected, notFound, errors, clockOffset, send };
}
