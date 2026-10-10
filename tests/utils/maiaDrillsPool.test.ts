/**
 * Maia Drills Stockfish pool, against a fake worker that answers UCI commands
 * asynchronously the way the real one does.
 *
 * Regression: a finished search used to be resolved after its worker had
 * already been handed the next queued job, which wiped the output; the job got
 * no scores and its card silently vanished. Decks lost cards whenever the
 * queue was busy, so the same games gave different decks run to run.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// vi.mock below is hoisted above this import, so the pool gets the fake worker.
import { SCORE_CLAMP, StockfishPool } from '~/utils/maiaDrills/stockfishPool';

/** Score for every candidate move, per position. */
let scoresByFen: Record<string, Record<string, number>> = {};
/** Positions whose search never finishes on its own (only `stop` ends it). */
let hangingFens = new Set<string>();
/** How many of the next workers fail to start, the way one does when the browser refuses its memory. */
let workersToFail = 0;

class FakeStockfish {
  onmessage: ((e: MessageEvent<string>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private fen = '';
  private searching: { fen: string; moves: string[] } | null = null;
  private broken = workersToFail > 0 && workersToFail-- > 0;

  private emit(...lines: string[]) {
    // Asynchronous, in order, like a real worker.
    setTimeout(() => lines.forEach((data) => this.onmessage?.({ data } as MessageEvent<string>)), 0);
  }

  private finish(search: { fen: string; moves: string[] }) {
    const scores = scoresByFen[search.fen] ?? {};
    this.emit(
      ...search.moves.map((m, i) => `info depth 12 seldepth 14 multipv ${i + 1} score cp ${scores[m] ?? 0} nodes 1 pv ${m}`),
      `bestmove ${search.moves[0]}`
    );
  }

  postMessage(cmd: string) {
    if (this.broken) {
      setTimeout(() => this.onerror?.({ message: 'RangeError: Out of memory' } as ErrorEvent), 0);
      return;
    }
    if (cmd === 'uci') this.emit('uciok');
    else if (cmd === 'isready') this.emit('readyok');
    else if (cmd.startsWith('position fen ')) this.fen = cmd.slice('position fen '.length);
    else if (cmd.startsWith('go ')) {
      const moves = cmd.split(' searchmoves ')[1].split(' ');
      this.searching = { fen: this.fen, moves };
      if (!hangingFens.has(this.fen)) {
        this.finish(this.searching);
        this.searching = null;
      }
    } else if (cmd === 'stop' && this.searching) {
      this.finish(this.searching);
      this.searching = null;
    }
  }

  terminate() {}
}

vi.mock('~/utils/multipleChoiceChess/stockfishEngine', () => ({
  createStockfishWorker: () => ({ worker: new FakeStockfish(), cleanup: () => {} }),
}));

beforeEach(() => {
  scoresByFen = {
    A: { e2e4: 30, a2a3: -10 },
    B: { d2d4: 200, h2h3: 5 },
    C: { g1f3: -40, b1c3: -60 },
  };
  hangingFens = new Set();
  workersToFail = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StockfishPool', () => {
  it('gives every queued job its own scores, even on one busy worker', async () => {
    const pool = new StockfishPool(1);
    await pool.ready();
    const [a, b, c] = await Promise.all([
      pool.score('A', ['e2e4', 'a2a3'], 12),
      pool.score('B', ['d2d4', 'h2h3'], 12),
      pool.score('C', ['g1f3', 'b1c3'], 12),
    ]);
    expect(Object.fromEntries(a)).toEqual({ e2e4: 30, a2a3: -10 });
    expect(Object.fromEntries(b)).toEqual({ d2d4: 200, h2h3: 5 });
    expect(Object.fromEntries(c)).toEqual({ g1f3: -40, b1c3: -60 });
    pool.terminate();
  });

  it('spreads jobs over several workers and still matches them up', async () => {
    const pool = new StockfishPool(2);
    await pool.ready();
    const jobs = Array.from({ length: 12 }, (_, i) => (['A', 'B', 'C'] as const)[i % 3]);
    const moves = { A: ['e2e4', 'a2a3'], B: ['d2d4', 'h2h3'], C: ['g1f3', 'b1c3'] };
    const results = await Promise.all(jobs.map((fen) => pool.score(fen, moves[fen], 12)));
    results.forEach((r, i) => {
      const fen = jobs[i];
      expect(Object.fromEntries(r)).toEqual(scoresByFen[fen]);
    });
    pool.terminate();
  });

  it('clamps mate and huge scores', async () => {
    scoresByFen.A = { e2e4: 5000, a2a3: -5000 };
    const pool = new StockfishPool(1);
    await pool.ready();
    const a = await pool.score('A', ['e2e4', 'a2a3'], 12);
    expect(Object.fromEntries(a)).toEqual({ e2e4: SCORE_CLAMP, a2a3: -SCORE_CLAMP });
    pool.terminate();
  });

  it('after a timeout, the stopped search’s late output doesn’t leak into the next job', async () => {
    vi.useFakeTimers();
    hangingFens.add('A');
    const pool = new StockfishPool(1);
    const ready = pool.ready();
    await vi.advanceTimersByTimeAsync(10);
    await ready;

    const stuck = pool.score('A', ['e2e4', 'a2a3'], 12);
    const stuckResult = stuck.catch((e: Error) => e.message);
    const next = pool.score('B', ['d2d4', 'h2h3'], 12);
    await vi.advanceTimersByTimeAsync(61_000);

    expect(await stuckResult).toBe('Stockfish search timed out');
    expect(Object.fromEntries(await next)).toEqual({ d2d4: 200, h2h3: 5 });
    pool.terminate();
  });

  it('carries on with the workers that started when others fail to', async () => {
    workersToFail = 2;
    const pool = new StockfishPool(3);
    await pool.ready();
    const [a, b, c] = await Promise.all([
      pool.score('A', ['e2e4', 'a2a3'], 12),
      pool.score('B', ['d2d4', 'h2h3'], 12),
      pool.score('C', ['g1f3', 'b1c3'], 12),
    ]);
    expect(Object.fromEntries(a)).toEqual({ e2e4: 30, a2a3: -10 });
    expect(Object.fromEntries(b)).toEqual({ d2d4: 200, h2h3: 5 });
    expect(Object.fromEntries(c)).toEqual({ g1f3: -40, b1c3: -60 });
    expect(pool.pending).toBe(0);
    pool.terminate();
  });

  it('fails to start when no worker does', async () => {
    workersToFail = 2;
    const pool = new StockfishPool(2);
    await expect(pool.ready()).rejects.toThrow('Out of memory');
    pool.terminate();
  });

  it('rejects queued jobs when terminated', async () => {
    hangingFens.add('A');
    const pool = new StockfishPool(1);
    await pool.ready();
    const running = pool.score('A', ['e2e4', 'a2a3'], 12);
    const queued = pool.score('B', ['d2d4', 'h2h3'], 12);
    pool.terminate();
    await expect(running).rejects.toThrow('Engine stopped');
    await expect(queued).rejects.toThrow('Engine stopped');
  });
});
