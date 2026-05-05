// Stockfish engine wrapper — runs the lite single-threaded WASM build as a Web Worker.
// Engine assets are loaded from external static hosting.

import { parseMultiPV, type CandidateMove, shuffle } from "./moveParser";

const WORKER_URL = 'https://externalwebsiteassets.s3.us-west-2.amazonaws.com/stockfish-18-lite-single.js';
const WASM_URL = 'https://externalwebsiteassets.s3.us-west-2.amazonaws.com/stockfish-18-lite-single.wasm';

type EngineState = 'uninitialized' | 'ready' | 'analyzing' | 'error';

interface PendingAnalysis {
  resolve: (moves: CandidateMove[]) => void;
  reject: (err: Error) => void;
  lines: string[];
  fen: string;
  timeoutId: ReturnType<typeof setTimeout>;
}

const INIT_TIMEOUT_MS = 45000;
const ANALYZE_TIMEOUT_BUFFER_MS = 8000;

function createStockfishWorker(): Worker {
  // Bootstrap as a same-origin blob worker, then load Stockfish from S3.
  // This Stockfish build expects worker location hash as: #<wasm-url>,worker
  // so it can resolve the wasm path correctly.
  const bootstrapSource = `
    importScripts(${JSON.stringify(WORKER_URL)});
  `;
  const blob = new Blob([bootstrapSource], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  const workerUrl = `${blobUrl}#${encodeURIComponent(WASM_URL)},worker`;

  try {
    return new Worker(workerUrl);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

class StockfishEngine {
  private worker: Worker | null = null;
  private state: EngineState = 'uninitialized';
  private initResolve: (() => void) | null = null;
  private initReject: ((err: Error) => void) | null = null;
  private pending: PendingAnalysis | null = null;

  async init(): Promise<void> {
    if (this.state === 'ready') return;

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.state = 'error';
        this.initResolve = null;
        this.initReject = null;
        reject(new Error('Engine init timed out'));
      }, INIT_TIMEOUT_MS);

      this.initResolve = () => { clearTimeout(timeoutId); resolve(); };
      this.initReject = (err) => { clearTimeout(timeoutId); reject(err); };

      try {
        this.worker = createStockfishWorker();
        this.worker.onmessage = this.handleMessage.bind(this);
        this.worker.onerror = (e) => {
          this.state = 'error';
          const err = new Error(`Engine worker error: ${e.message || 'unknown'}`);
          this.initReject?.(err);
          this.initReject = null;
          this.initResolve = null;
          this.failPending(err);
        };
        this.worker.postMessage('uci');
      } catch (err) {
        clearTimeout(timeoutId);
        this.state = 'error';
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  private failPending(err: Error) {
    if (this.pending) {
      clearTimeout(this.pending.timeoutId);
      this.pending.reject(err);
      this.pending = null;
    }
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
        const { resolve, lines, fen, timeoutId } = this.pending;
        clearTimeout(timeoutId);
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
      const timeoutId = setTimeout(() => {
        this.failPending(new Error('Engine analysis timed out'));
        this.state = 'ready';
      }, movetime + ANALYZE_TIMEOUT_BUFFER_MS);

      this.pending = { resolve, reject, lines: [], fen, timeoutId };

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
