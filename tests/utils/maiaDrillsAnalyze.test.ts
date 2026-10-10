/**
 * Maia Drills analysis pipeline, with Maia and Stockfish replaced by fakes:
 * which positions become cards, what ratings Maia is asked to play at, and
 * how missing ratings, failed searches, and cancelling behave.
 */

import { describe, it, expect, vi } from 'vitest';
import { alreadyLost, analyzeGames, userMoves, type AnalysisProgress } from '~/utils/maiaDrills/analyze';
import type { MaiaEngine, MaiaQuery } from '~/utils/maiaDrills/maiaEngine';
import type { StockfishPool } from '~/utils/maiaDrills/stockfishPool';
import { DEFAULT_SETTINGS, LOST_CP, type SourceGame } from '~/utils/maiaDrills/types';

// stockfishPool imports the worker factory; the fakes below replace the pool.
vi.mock('~/utils/multipleChoiceChess/stockfishEngine', () => ({ createStockfishWorker: vi.fn() }));

// The user is Black: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#
const game: SourceGame = {
  id: 'scholar',
  url: 'https://lichess.org/scholar',
  white: 'opp',
  black: 'me',
  whiteElo: 1450,
  blackElo: 1400,
  userColor: 'b',
  speed: 'blitz',
  san: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'],
};

/** Position before 3…Nf6, where a stronger player defends with …g6. */
const BEFORE_NF6 = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';

/**
 * Maia agrees with whatever the user played, except in the positions listed in
 * `picks` (by FEN). Every query is recorded in `seen`.
 */
function fakeMaia(picks: Record<string, string> = {}, seen: MaiaQuery[] = []) {
  const played = new Map<string, string>();
  for (const m of userMoves(game, 0)) played.set(m.fen, m.played.uci);
  return {
    predict: vi.fn(async (queries: MaiaQuery[], onProgress?: (done: number) => void) => {
      seen.push(...queries);
      onProgress?.(queries.length);
      return queries.map((q) => [{ uci: picks[q.fen] ?? played.get(q.fen)!, prob: 0.5 }]);
    }),
  } as unknown as MaiaEngine;
}

/** Stockfish scores per move; unlisted moves score 0. */
function fakeStockfish(scores: Record<string, number>, opts: { fail?: boolean } = {}) {
  return {
    pending: 0,
    score: vi.fn(async (_fen: string, moves: string[]) => {
      if (opts.fail) throw new Error('search timed out');
      return new Map(moves.map((m) => [m, scores[m] ?? 0]));
    }),
    terminate: vi.fn(),
  } as unknown as StockfishPool;
}

describe('analyzeGames', () => {
  it('makes a card where a stronger player disagrees and the gap clears the threshold', async () => {
    const maia = fakeMaia({ [BEFORE_NF6]: 'g7g6' });
    const stockfish = fakeStockfish({ g7g6: 20, g8f6: -1000 });

    const { cards, stats } = await analyzeGames([game], DEFAULT_SETTINGS, { maia, stockfish }, {});

    expect(stats).toEqual({ games: 1, positions: 3, disagreements: 1 });
    expect(stockfish.score).toHaveBeenCalledTimes(1);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toMatchObject({
      id: 'scholar-5',
      fen: BEFORE_NF6,
      color: 'b',
      played: { uci: 'g8f6', san: 'Nf6' },
      target: { uci: 'g7g6', san: 'g6' },
      evalTarget: 20,
      evalPlayed: -1000,
      userElo: 1400,
      targetElo: 1600,
      oppElo: 1450,
      opponent: 'opp',
      gameUrl: 'https://lichess.org/scholar',
    });
  });

  it('asks Maia to play at the user’s rating plus the gap, against the real opponent', async () => {
    const seen: MaiaQuery[] = [];
    const maia = fakeMaia({}, seen);
    await analyzeGames([game], { ...DEFAULT_SETTINGS, delta: 300 }, { maia, stockfish: fakeStockfish({}) }, {});
    expect(seen.every((q) => q.eloSelf === 1700 && q.eloOppo === 1450)).toBe(true);
  });

  it('keeps a gap equal to the threshold and drops one just under it', async () => {
    const maia = () => fakeMaia({ [BEFORE_NF6]: 'g7g6' });
    const at = await analyzeGames([game], DEFAULT_SETTINGS, { maia: maia(), stockfish: fakeStockfish({ g7g6: 150, g8f6: 0 }) }, {});
    const under = await analyzeGames([game], DEFAULT_SETTINGS, { maia: maia(), stockfish: fakeStockfish({ g7g6: 149, g8f6: 0 }) }, {});
    expect(at.cards).toHaveLength(1);
    expect(under.cards).toHaveLength(0);
  });

  it('leaves out an error made when already lost, by default, and counts it', async () => {
    const maia = () => fakeMaia({ [BEFORE_NF6]: 'g7g6' });
    const lost = { g7g6: -LOST_CP, g8f6: -1000 };
    const on = await analyzeGames([game], DEFAULT_SETTINGS, { maia: maia(), stockfish: fakeStockfish(lost) }, {});
    expect(on.cards).toHaveLength(0);
    expect(on.stats.lost).toBe(1);
    // Decks from before the option (no skipLost) kept every error.
    const off = await analyzeGames([game], { ...DEFAULT_SETTINGS, skipLost: undefined }, { maia: maia(), stockfish: fakeStockfish(lost) }, {});
    expect(off.cards).toHaveLength(1);
    expect(off.stats.lost).toBeUndefined();
  });

  it('counts a position as lost only when down LOST_CP both before and after the move', () => {
    expect(alreadyLost(-LOST_CP, -LOST_CP - 200)).toBe(true);
    // Still in it with the stronger move: that's the card worth drilling.
    expect(alreadyLost(-LOST_CP + 1, -1000)).toBe(false);
    expect(alreadyLost(-300, -1000)).toBe(false);
  });

  it('skips moves before the chosen move number', async () => {
    const seen: MaiaQuery[] = [];
    const maia = fakeMaia({}, seen);
    await analyzeGames([game], { ...DEFAULT_SETTINGS, skipMoves: 2 }, { maia, stockfish: fakeStockfish({}) }, {});
    expect(seen.map((q) => q.fen)).toEqual([BEFORE_NF6]);
  });

  it('skips a game with no rating for the user', async () => {
    const unrated = { ...game, blackElo: null };
    const result = await analyzeGames([unrated], DEFAULT_SETTINGS, { maia: fakeMaia({}), stockfish: fakeStockfish({}) }, {});
    expect(result.skippedNoRating).toBe(1);
    expect(result.stats.games).toBe(0);
  });

  it('uses the user’s rating for a missing opponent rating, and clamps to Maia’s range', async () => {
    const seen: MaiaQuery[] = [];
    const strong = { ...game, whiteElo: null, blackElo: 2550 };
    await analyzeGames([strong], DEFAULT_SETTINGS, { maia: fakeMaia({}, seen), stockfish: fakeStockfish({}) }, {});
    expect(seen[0]).toMatchObject({ eloSelf: 2600, eloOppo: 2550 });
  });

  it('drops a position whose search fails, without failing the run', async () => {
    const maia = fakeMaia({ [BEFORE_NF6]: 'g7g6' });
    const result = await analyzeGames([game], DEFAULT_SETTINGS, { maia, stockfish: fakeStockfish({}, { fail: true }) }, {});
    expect(result.cards).toHaveLength(0);
    expect(result.stats.disagreements).toBe(1);
  });

  it('stops before the first game when already cancelled, and stops the engines', async () => {
    const controller = new AbortController();
    controller.abort();
    const maia = fakeMaia({});
    const stockfish = fakeStockfish({});
    const result = await analyzeGames([game, game], DEFAULT_SETTINGS, { maia, stockfish }, { signal: controller.signal });
    expect(result.cancelled).toBe(true);
    expect(maia.predict).not.toHaveBeenCalled();
    expect(stockfish.terminate).toHaveBeenCalled();
  });

  it('sorts cards biggest miss first', async () => {
    const second: SourceGame = { ...game, id: 'g2', san: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'] };
    const maia = fakeMaia({ [BEFORE_NF6]: 'g7g6' });
    let call = 0;
    const stockfish = {
      pending: 0,
      terminate: vi.fn(),
      // First game: a 200 cp miss; second: 900.
      score: vi.fn(async (_f: string, moves: string[]) => new Map([[moves[0], call++ === 0 ? 200 : 900], [moves[1], 0]])),
    } as unknown as StockfishPool;
    const { cards } = await analyzeGames([game, second], DEFAULT_SETTINGS, { maia, stockfish }, {});
    expect(cards.map((c) => c.id)).toEqual(['g2-5', 'scholar-5']);
  });

  it('counts a game as analyzed only once its Stockfish checks finish', async () => {
    const maia = fakeMaia({ [BEFORE_NF6]: 'g7g6' });
    let finishSearch: (scores: Map<string, number>) => void = () => {};
    const stockfish = {
      pending: 0,
      score: vi.fn(() => new Promise<Map<string, number>>((resolve) => (finishSearch = resolve))),
      terminate: vi.fn(),
    } as unknown as StockfishPool;
    const reports: AnalysisProgress[] = [];

    const run = analyzeGames([game], DEFAULT_SETTINGS, { maia, stockfish }, {
      onProgress: (p) => reports.push(p),
    });
    await vi.waitFor(() => expect(stockfish.score).toHaveBeenCalled());
    // Maia is done with the game, but its one Stockfish check isn't.
    expect(reports.at(-1)).toMatchObject({
      gamesDone: 0,
      current: { positions: 3, positionsDone: 3, maiaDone: true, checks: 1, checksDone: 0 },
    });
    // Before Maia finished, the game showed with no checks known yet.
    expect(reports[0].current).toMatchObject({ positionsDone: 0, maiaDone: false, checks: 0 });

    finishSearch(new Map([['g7g6', 20], ['g8f6', -1000]]));
    const { cards } = await run;
    // Done: the count ticks up and the per-game bars clear.
    expect(reports.at(-1)).toMatchObject({ gamesDone: 1, current: null });
    expect(cards).toHaveLength(1);
  });
});
