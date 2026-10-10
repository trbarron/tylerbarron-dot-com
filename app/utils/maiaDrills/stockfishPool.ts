// A small pool of Stockfish workers that score a handful of candidate moves in
// a position. Uses the same CDN-hosted lite build as Multiple Choice Chess.
//
// Each job is `go depth D searchmoves m1 m2 …` with MultiPV set to the number
// of candidates, so one search scores every candidate from the mover's side.

import { createStockfishWorker } from '~/utils/multipleChoiceChess/stockfishEngine';

/** Mates and crushing evals collapse to this, so a won position can't produce a "1500 cp error". */
export const SCORE_CLAMP = 1000;

const INIT_TIMEOUT_MS = 45000;
/** Generous: depth-limited searches on a slow phone can take a few seconds each. */
const JOB_TIMEOUT_MS = 60000;

/**
 * Pull the final score for each root move out of a search's `info` lines.
 * Later lines overwrite earlier ones, so the deepest completed iteration wins.
 * Returns centipawns from the side to move, clamped to ±SCORE_CLAMP.
 */
export function parseCandidateScores(lines: string[]): Map<string, number> {
  const scores = new Map<string, number>();
  for (const line of lines) {
    if (!line.startsWith('info') || line.includes(' lowerbound') || line.includes(' upperbound')) continue;
    const score = line.match(/ score (cp|mate) (-?\d+)/);
    const pv = line.match(/ pv (\S+)/);
    if (!score || !pv) continue;

    const value = Number(score[2]);
    const cp =
      score[1] === 'mate'
        ? value > 0 ? SCORE_CLAMP : -SCORE_CLAMP
        : Math.max(-SCORE_CLAMP, Math.min(SCORE_CLAMP, value));
    scores.set(pv[1], cp);
  }
  return scores;
}

interface Job {
  fen: string;
  moves: string[];
  depth: number;
  resolve: (scores: Map<string, number>) => void;
  reject: (err: Error) => void;
}

class PooledEngine {
  private worker: Worker;
  private cleanup: () => void;
  private lines: string[] = [];
  private current: Job | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  /**
   * Searches that timed out and were told to stop. Each still ends with its
   * own `bestmove`, after the next job has started; until it arrives, output
   * belongs to the abandoned search, not the current one.
   */
  private abandoned = 0;
  private onIdle: () => void;
  /** Commands sent before `readyok` can be dropped, so jobs wait for it. */
  isReady = false;
  ready: Promise<void>;

  constructor(onIdle: () => void) {
    this.onIdle = onIdle;
    const { worker, cleanup } = createStockfishWorker();
    this.worker = worker;
    this.cleanup = cleanup;

    this.ready = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Stockfish failed to start')), INIT_TIMEOUT_MS);
      this.worker.onmessage = (e: MessageEvent<string>) => {
        const line = String(e.data);
        if (line === 'uciok') this.worker.postMessage('isready');
        else if (line === 'readyok') {
          clearTimeout(timer);
          this.worker.onmessage = (ev: MessageEvent<string>) => this.handleLine(String(ev.data));
          this.isReady = true;
          resolve();
          this.onIdle();
        }
      };
      this.worker.onerror = (e) => {
        clearTimeout(timer);
        const err = new Error(`Stockfish worker error: ${e.message || 'unknown'}`);
        reject(err);
        this.fail(err);
      };
    });
    this.worker.postMessage('uci');
  }

  get busy(): boolean {
    return this.current !== null;
  }

  run(job: Job) {
    this.current = job;
    this.lines = [];
    this.timeoutId = setTimeout(() => {
      this.worker.postMessage('stop');
      this.abandoned++;
      this.fail(new Error('Stockfish search timed out'));
    }, JOB_TIMEOUT_MS);

    // A fresh hash table per search, so a position's score depends only on the
    // position, not on what this worker happened to search before it.
    this.worker.postMessage('ucinewgame');
    this.worker.postMessage(`setoption name MultiPV value ${job.moves.length}`);
    this.worker.postMessage(`position fen ${job.fen}`);
    this.worker.postMessage(`go depth ${job.depth} searchmoves ${job.moves.join(' ')}`);
  }

  private handleLine(line: string) {
    if (this.abandoned > 0) {
      if (line.startsWith('bestmove')) this.abandoned--;
      return;
    }
    if (!this.current) return;
    if (line.startsWith('info')) {
      this.lines.push(line);
      return;
    }
    if (line.startsWith('bestmove')) {
      // Parse before finish(): it hands this worker the next queued job, which
      // resets `lines`. Resolving after that gave the finished job no scores,
      // and its position was silently dropped whenever the queue was busy.
      const job = this.current;
      const scores = parseCandidateScores(this.lines);
      this.finish();
      job.resolve(scores);
    }
  }

  private finish() {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.current = null;
    this.onIdle();
  }

  private fail(err: Error) {
    const job = this.current;
    if (!job) return;
    this.finish();
    job.reject(err);
  }

  terminate() {
    this.worker.terminate();
    this.cleanup();
    this.fail(new Error('Engine stopped'));
  }
}

export class StockfishPool {
  private engines: PooledEngine[] = [];
  private queue: Job[] = [];
  private closed = false;

  constructor(size: number) {
    for (let i = 0; i < size; i++) this.engines.push(new PooledEngine(() => this.pump()));
  }

  /** A pool sized to leave a core for the page and Maia's worker. */
  static forDevice(): StockfishPool {
    const cores = typeof navigator === 'undefined' ? 2 : navigator.hardwareConcurrency ?? 2;
    return new StockfishPool(Math.max(1, Math.min(cores - 1, 4)));
  }

  async ready(): Promise<void> {
    await Promise.all(this.engines.map((e) => e.ready));
  }

  /** Score each of `moves` (UCI) in `fen`, from the side to move. */
  score(fen: string, moves: string[], depth: number): Promise<Map<string, number>> {
    if (this.closed) return Promise.reject(new Error('Engine stopped'));
    return new Promise((resolve, reject) => {
      this.queue.push({ fen, moves, depth, resolve, reject });
      this.pump();
    });
  }

  get pending(): number {
    return this.queue.length + this.engines.filter((e) => e.busy).length;
  }

  private pump() {
    for (const engine of this.engines) {
      if (this.queue.length === 0) return;
      if (engine.isReady && !engine.busy) engine.run(this.queue.shift()!);
    }
  }

  terminate() {
    this.closed = true;
    const err = new Error('Engine stopped');
    for (const job of this.queue.splice(0)) job.reject(err);
    for (const engine of this.engines) engine.terminate();
  }
}
