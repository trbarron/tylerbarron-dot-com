import { GAME_ID_RE, PLAYER_ID_RE, SEATS, type PlayerAction, type SeatKey } from './types';

/** Game codes are typed by players; they're matched case-insensitively. */
export function parseGameId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim().toLowerCase();
  return GAME_ID_RE.test(id) ? id : null;
}

export function parsePlayerId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const id = raw.trim();
  return PLAYER_ID_RE.test(id) ? id : null;
}

export function parseAction(raw: unknown): PlayerAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, unknown>;
  switch (a.type) {
    case 'take_seat':
      return SEATS.includes(a.seat as SeatKey) ? { type: 'take_seat', seat: a.seat as SeatKey } : null;
    case 'ready':
    case 'not_ready':
    case 'lock_in':
      return { type: a.type };
    case 'submit_move':
      return typeof a.move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(a.move)
        ? { type: 'submit_move', move: a.move }
        : null;
    default:
      return null;
  }
}
