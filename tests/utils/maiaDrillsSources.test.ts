/**
 * Maia Drills game fetchers, with fetch mocked: the Lichess NDJSON stream
 * (including a game split across chunks) and Chess.com's monthly archives.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchChessComGames, fetchLichessGames } from '~/utils/maiaDrills/gameSources';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A streamed response whose body arrives in the given chunks. */
function streamed(chunks: string[], status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(encoder.encode(c)));
      controller.close();
    },
  });
  return new Response(body, { status });
}

function lichessGame(id: string, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    id,
    variant: 'standard',
    speed: 'blitz',
    createdAt: 1_700_000_000_000,
    moves: 'e4 e5 Nf3 Nc6',
    players: {
      white: { user: { name: 'Tyler' }, rating: 1500 },
      black: { user: { name: 'Opp' }, rating: 1550 },
    },
    ...extra,
  });
}

describe('fetchLichessGames', () => {
  it('parses a stream whose lines are split across chunks', async () => {
    const lines = `${lichessGame('aaaaaaaa')}\n${lichessGame('bbbbbbbb')}\n`;
    const fetchMock = vi.fn().mockResolvedValue(streamed([lines.slice(0, 50), lines.slice(50, 260), lines.slice(260)]));
    vi.stubGlobal('fetch', fetchMock);

    const games = await fetchLichessGames('tyler', { max: 10, excludeBullet: true });

    expect(games.map((g) => g.id)).toEqual(['aaaaaaaa', 'bbbbbbbb']);
    expect(games[0]).toMatchObject({
      url: 'https://lichess.org/aaaaaaaa',
      userColor: 'w',
      whiteElo: 1500,
      blackElo: 1550,
      speed: 'blitz',
      san: ['e4', 'e5', 'Nf3', 'Nc6'],
    });
    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.searchParams.get('perfType')).toBe('blitz,rapid,classical');
    expect(url.searchParams.get('max')).toBe('10');
  });

  it('asks only for games after `since`', async () => {
    const fetchMock = vi.fn().mockResolvedValue(streamed(['']));
    vi.stubGlobal('fetch', fetchMock);
    await fetchLichessGames('tyler', { max: 500, excludeBullet: true, since: 1_700_000_000_000 });
    // Lichess's `since` is inclusive; +1 skips the game the deck already has.
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('since')).toBe('1700000000001');
  });

  it('drops games at or before `since` even when Lichess sends them anyway', async () => {
    // Seen live: asked for games after a game's createdAt, Lichess still returned that game.
    const since = 1_700_000_000_000;
    const lines = [lichessGame('newer001', { createdAt: since + 60_000 }), lichessGame('samegame', { createdAt: since })].join('\n');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamed([lines])));
    const games = await fetchLichessGames('tyler', { max: 500, excludeBullet: true, since });
    expect(games.map((g) => g.id)).toEqual(['newer001']);
  });

  it('handles a final line with no trailing newline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamed([lichessGame('cccccccc')])));
    expect(await fetchLichessGames('tyler', { max: 1, excludeBullet: false })).toHaveLength(1);
  });

  it('skips variants and keeps games from a custom position', async () => {
    const lines = [
      lichessGame('variant1', { variant: 'chess960' }),
      lichessGame('frompos1', { variant: 'fromPosition', initialFen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', moves: 'e4 Kd7' }),
    ].join('\n');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamed([lines])));
    const games = await fetchLichessGames('tyler', { max: 10, excludeBullet: false });
    expect(games.map((g) => g.id)).toEqual(['frompos1']);
    expect(games[0].startFen).toBe('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
  });

  it('works out the user’s color case-insensitively', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamed([lichessGame('dddddddd')])));
    expect((await fetchLichessGames('OPP', { max: 1, excludeBullet: false }))[0].userColor).toBe('b');
  });

  it('turns 404 and 429 into readable errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(fetchLichessGames('ghost', { max: 1, excludeBullet: false })).rejects.toThrow('No Lichess player named "ghost".');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 429 })));
    await expect(fetchLichessGames('tyler', { max: 1, excludeBullet: false })).rejects.toThrow(/rate-limiting/);
  });
});

describe('fetchChessComGames', () => {
  const pgn = '[Event "Live"]\n[White "Tyler"]\n[Black "Opp"]\n\n1. e4 e5 2. Nf3 Nc6 1-0';
  const game = (id: number, extra: Record<string, unknown> = {}) => ({
    url: `https://www.chess.com/game/live/${id}`,
    pgn,
    rules: 'chess',
    time_class: 'blitz',
    time_control: '300+0',
    end_time: 1_700_000_000 + id,
    white: { username: 'Tyler', rating: 1200 },
    black: { username: 'Opp', rating: 1250 },
    ...extra,
  });

  function mockArchives(months: Record<string, unknown[]>) {
    const archives = Object.keys(months).map((m) => `https://api.chess.com/pub/player/tyler/games/${m}`);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/archives')) return Response.json({ archives });
      const month = url.split('/games/')[1];
      return Response.json({ games: months[month] });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('walks months newest first and stops at the limit', async () => {
    const fetchMock = mockArchives({
      '2026/08': [game(1), game(2)],
      '2026/09': [game(3), game(4)],
      '2026/10': [game(5)],
    });
    const games = await fetchChessComGames('Tyler', { max: 3, excludeBullet: false });
    expect(games.map((g) => g.id)).toEqual(['5', '4', '3']);
    // The oldest month is never fetched.
    expect(fetchMock.mock.calls.map(([u]) => u)).not.toContain('https://api.chess.com/pub/player/tyler/games/2026/08');
  });

  it('skips daily games, variants, and bullet when asked', async () => {
    mockArchives({
      '2026/10': [
        game(1, { time_class: 'daily' }),
        game(2, { rules: 'chess960' }),
        game(3, { time_class: 'bullet', time_control: '60' }),
        game(4),
      ],
    });
    const games = await fetchChessComGames('tyler', { max: 10, excludeBullet: true });
    expect(games.map((g) => g.id)).toEqual(['4']);
    expect(games[0]).toMatchObject({ userColor: 'w', whiteElo: 1200, blackElo: 1250, speed: 'blitz', san: ['e4', 'e5', 'Nf3', 'Nc6'] });
  });

  it('with `since`, keeps only newer games and stops at the month that reaches it', async () => {
    // end_time is 1_700_000_000 + id (seconds); `since` falls between games 4 and 5.
    const since = (1_700_000_000 + 4) * 1000;
    const fetchMock = mockArchives({
      '2026/08': [game(1), game(2)],
      '2026/09': [game(3), game(4), game(5)],
      '2026/10': [game(6)],
    });
    const games = await fetchChessComGames('tyler', { max: 500, excludeBullet: false, since });
    expect(games.map((g) => g.id)).toEqual(['6', '5']);
    expect(fetchMock.mock.calls.map(([u]) => u)).not.toContain('https://api.chess.com/pub/player/tyler/games/2026/08');
  });

  it('turns 404 into a readable error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(fetchChessComGames('ghost', { max: 1, excludeBullet: false })).rejects.toThrow('No Chess.com player named "ghost".');
  });
});
