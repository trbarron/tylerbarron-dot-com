// Fetch a player's recent games from Lichess or Chess.com into one normalized
// shape. Runs in the browser: both APIs send CORS headers.

import { Chess } from 'chess.js';
import type { SourceGame, Speed } from './types';

const STANDARD_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface FetchOptions {
  max: number;
  excludeBullet: boolean;
  /** Only games played after this (ms since epoch), for adding to a deck. */
  since?: number;
  signal?: AbortSignal;
  /** Called with the number of games collected so far. */
  onProgress?: (count: number) => void;
}

function toElo(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/** Bucket by estimated game time the way Lichess does (base + 40 × increment). */
export function speedFromTimeControl(tc: string | undefined): Speed {
  if (!tc || tc === '-' || tc === '?') return 'unknown';
  if (tc.includes('/')) return 'correspondence';
  const [base, inc] = tc.split('+').map(Number);
  if (!Number.isFinite(base)) return 'unknown';
  const total = base + 40 * (inc || 0);
  if (total < 180) return 'bullet';
  if (total < 480) return 'blitz';
  if (total < 1500) return 'rapid';
  return 'classical';
}

// ── Lichess ────────────────────────────────────────────────────────────────

interface LichessGame {
  id: string;
  variant: string;
  speed: string;
  createdAt: number;
  initialFen?: string;
  moves?: string;
  players: {
    white: { user?: { name: string }; rating?: number };
    black: { user?: { name: string }; rating?: number };
  };
}

export async function fetchLichessGames(username: string, opts: FetchOptions): Promise<SourceGame[]> {
  const perfs = ['blitz', 'rapid', 'classical', ...(opts.excludeBullet ? [] : ['bullet'])];
  const params = new URLSearchParams({
    max: String(opts.max),
    perfType: perfs.join(','),
    moves: 'true',
    tags: 'false',
    clocks: 'false',
    evals: 'false',
    opening: 'false',
  });
  // Lichess's `since` narrows the export but isn't exact: asked for games after
  // a game's own createdAt, it still returns that game. So it's only a hint,
  // and the strict filter is applied to each game below.
  if (opts.since !== undefined) params.set('since', String(opts.since + 1));
  const res = await fetch(`https://lichess.org/api/games/user/${encodeURIComponent(username)}?${params}`, {
    headers: { Accept: 'application/x-ndjson' },
    signal: opts.signal,
  });
  if (res.status === 404) throw new Error(`No Lichess player named "${username}".`);
  if (res.status === 429) throw new Error('Lichess is rate-limiting requests. Wait a minute and try again.');
  if (!res.ok || !res.body) throw new Error(`Lichess returned ${res.status}.`);

  // The export streams one game per line; read it as it arrives so progress moves.
  const games: SourceGame[] = [];
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  const lower = username.toLowerCase();

  const handleLine = (line: string) => {
    if (!line.trim()) return;
    const g = JSON.parse(line) as LichessGame;
    if (opts.since !== undefined && g.createdAt <= opts.since) return;
    if (g.variant !== 'standard' && g.variant !== 'fromPosition') return;
    const white = g.players.white.user?.name ?? 'Anonymous';
    const black = g.players.black.user?.name ?? 'Anonymous';
    const san = (g.moves ?? '').split(' ').filter(Boolean);
    if (san.length < 2) return;
    games.push({
      id: g.id,
      url: `https://lichess.org/${g.id}`,
      white,
      black,
      whiteElo: toElo(g.players.white.rating),
      blackElo: toElo(g.players.black.rating),
      userColor: white.toLowerCase() === lower ? 'w' : 'b',
      speed: (['bullet', 'blitz', 'rapid', 'classical', 'correspondence'].includes(g.speed) ? g.speed : 'unknown') as Speed,
      playedAt: g.createdAt,
      startFen: g.initialFen && g.initialFen !== STANDARD_FEN ? g.initialFen : undefined,
      san,
    });
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(handleLine);
    opts.onProgress?.(games.length);
  }
  handleLine(buffer);
  opts.onProgress?.(games.length);
  return games;
}

// ── Chess.com ──────────────────────────────────────────────────────────────

interface ChessComGame {
  url: string;
  pgn?: string;
  rules: string;
  time_class: string;
  time_control: string;
  end_time: number;
  initial_setup?: string;
  white: { username: string; rating: number };
  black: { username: string; rating: number };
}

export async function fetchChessComGames(username: string, opts: FetchOptions): Promise<SourceGame[]> {
  const user = username.toLowerCase();
  const archivesRes = await fetch(`https://api.chess.com/pub/player/${encodeURIComponent(user)}/games/archives`, {
    signal: opts.signal,
  });
  if (archivesRes.status === 404) throw new Error(`No Chess.com player named "${username}".`);
  if (!archivesRes.ok) throw new Error(`Chess.com returned ${archivesRes.status}.`);
  const { archives } = (await archivesRes.json()) as { archives: string[] };

  const games: SourceGame[] = [];
  // Archives are monthly and oldest-first; walk back from the newest month.
  // With `since`, the first month holding an already-analyzed game is the last
  // one worth reading: every month before it is older still.
  for (const archiveUrl of [...archives].reverse()) {
    if (games.length >= opts.max) break;
    const res = await fetch(archiveUrl, { signal: opts.signal });
    if (!res.ok) continue;
    const month = (await res.json()) as { games: ChessComGame[] };
    let reachedOld = false;

    for (const g of [...month.games].reverse()) {
      if (games.length >= opts.max) break;
      if (opts.since !== undefined && g.end_time * 1000 <= opts.since) {
        reachedOld = true;
        continue;
      }
      if (g.rules !== 'chess' || !g.pgn) continue;
      if (opts.excludeBullet && g.time_class === 'bullet') continue;
      if (g.time_class === 'daily') continue;
      const parsed = parsePgnMoves(g.pgn);
      if (!parsed || parsed.san.length < 2) continue;
      games.push({
        id: g.url.split('/').pop() ?? g.url,
        url: g.url,
        white: g.white.username,
        black: g.black.username,
        whiteElo: toElo(g.white.rating),
        blackElo: toElo(g.black.rating),
        userColor: g.white.username.toLowerCase() === user ? 'w' : 'b',
        speed: speedFromTimeControl(g.time_control),
        playedAt: g.end_time * 1000,
        startFen: parsed.startFen,
        san: parsed.san,
      });
    }
    opts.onProgress?.(games.length);
    if (reachedOld) break;
  }
  return games;
}

/** Chess.com sends each game as PGN; replay it for the move list. */
function parsePgnMoves(pgn: string): { san: string[]; startFen?: string } | null {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }
  const headers = chess.getHeaders();
  const startFen = headers.FEN && headers.FEN !== STANDARD_FEN ? headers.FEN : undefined;
  return { san: chess.history(), startFen };
}
