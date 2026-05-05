// Stockfish engine wrapper — runs the lite single-threaded WASM build as a Web Worker.
// The JS and WASM files are served from /public via the Vite copy plugin.

import { parseMultiPV, type CandidateMove, shuffle } from "./moveParser";

const WORKER_URL = '/stockfish-18-lite-single.js';

type EngineState = 'uninitialized' | 'ready' | 'analyzing' | 'error';

interface PendingAnalysis {
  resolve: (moves: CandidateMove[]) => void;
  reject: (err: Error) => void;
  lines: string[];
  fen: string;
}

class StockfishEngine {
  private worker: Worker | null = null;
  private state: EngineState = 'uninitialized';
  private initResolve: (() => void) | null = null;
  private initReject: ((err: Error) => void) | null = null;
  private pending: PendingAnalysis | null = null;

  async init(): Promise<void> {
    if (this.state === 'ready') return;
    if (this.state === 'analyzing') return;

    return new Promise((resolve, reject) => {
      this.initResolve = resolve;
      this.initReject = reject;

      try {
        this.worker = new Worker(WORKER_URL);
        this.worker.onmessage = this.handleMessage.bind(this);
        this.worker.onerror = (e) => {
          this.state = 'error';
          this.initReject?.(new Error(`Engine worker error: ${e.message}`));
          this.initReject = null;
        };
        this.worker.postMessage('uci');
      } catch (err) {
        this.state = 'error';
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private handleMessage(event: MessageEvent<string>) {
    const line = typeof event.data === 'string' ? event.data : String(event.data);

    if (line === 'uciok') {
      this.worker?.postMessage('isready');
      return;
    }

    if (line === 'readyok') {
      this.state = 'ready';
      this.initResolve?.();
      this.initResolve = null;
      return;
    }

    if (this.pending) {
      if (line.startsWith('info') && line.includes('multipv')) {
        this.pending.lines.push(line);
      }

      if (line.startsWith('bestmove')) {
        const { resolve, lines, fen } = this.pending;
        this.pending = null;
        this.state = 'ready';

        const moves = parseMultiPV(lines, fen);
        resolve(shuffle(moves));
      }
    }
  }

  async analyze(fen: string, movetime: number): Promise<CandidateMove[]> {
    if (this.state !== 'ready') {
      throw new Error('Engine not ready');
    }

    this.state = 'analyzing';

    return new Promise((resolve, reject) => {
      this.pending = { resolve, reject, lines: [], fen };

      this.worker?.postMessage('setoption name MultiPV value 6');
      this.worker?.postMessage(`position fen ${fen}`);
      this.worker?.postMessage(`go movetime ${movetime}`);
    });
  }

  terminate() {
    this.worker?.postMessage('quit');
    this.worker?.terminate();
    this.worker = null;
    this.state = 'uninitialized';
    this.pending = null;
  }

  get isReady(): boolean {
    return this.state === 'ready';
  }
}

// Singleton per page load
let engine: StockfishEngine | null = null;

export function getEngine(): StockfishEngine {
  if (!engine) engine = new StockfishEngine();
  return engine;
}

// Determine appropriate think time based on device capability
export function getThinkTime(): number {
  if (typeof navigator === 'undefined') return 2000;
  return (navigator.hardwareConcurrency ?? 4) < 4 ? 1000 : 2000;
}
