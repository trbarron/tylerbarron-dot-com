// Stockfish engine wrapper — runs the lite single-threaded WASM build as a Web Worker.
// Engine assets are loaded from unpkg's CDN. The 7.3 MB WASM exceeds API Gateway's
// 6 MB Lambda response cap, so it can't be served from our own origin without
// bypassing the Lambda; jsDelivr rejects the package for being >150 MB across
// its WASM variants, so unpkg is the path that works.

import { parseMultiPV, type CandidateMove, shuffle } from "./moveParser";

const STOCKFISH_VERSION = '18.0.7';
const WORKER_URL = `https://unpkg.com/stockfish@${STOCKFISH_VERSION}/bin/stockfish-18-lite-single.js`;
const WASM_URL = `https://unpkg.com/stockfish@${STOCKFISH_VERSION}/bin/stockfish-18-lite-single.wasm`;

type EngineState = 'uninitialized' | 'ready' | 'analyzing' | 'error';

export class EngineTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineTimeoutError';
  }
}

export function isEngineTimeoutError(err: unknown): err is EngineTimeoutError {
  return err instanceof EngineTimeoutError;
}

interface PendingAnalysis {
  resolve: (moves: CandidateMove[]) => void;
  reject: (err: Error) => void;
  lines: string[];
  fen: string;
  timeoutId: ReturnType<typeof setTimeout>;
}

const INIT_TIMEOUT_MS = 45000;
const ANALYZE_TIMEOUT_BUFFER_MS = 8000;

function createStockfishWorker(): { worker: Worker; cleanup: () => void } {
  // Workers can't be created directly from a cross-origin URL, so bootstrap a
  // same-origin blob worker that importScripts the CDN-hosted Stockfish JS.
  // Stockfish reads location.hash for the wasm path: hash format is `#<wasm-url>`.
  // Do NOT append `,worker` — it short-circuits Stockfish's `||` entry chain
  // before the ternary that actually wires up onmessage and instantiates wasm,
  // leaving the worker silent.
  const bootstrapSource = `importScripts(${JSON.stringify(WORKER_URL)});`;
  const blob = new Blob([bootstrapSource], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  const workerUrl = `${blobUrl}#${encodeURIComponent(WASM_URL)}`;

  const worker = new Worker(workerUrl);
  return { worker, cleanup: () => URL.revokeObjectURL(blobUrl) };
}

class StockfishEngine {
  private worker: Worker | null = null;
  private cleanupBlob: (() => void) | null = null;
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
        reject(new EngineTimeoutError('Engine init timed out'));
      }, INIT_TIMEOUT_MS);

      this.initResolve = () => { clearTimeout(timeoutId); resolve(); };
      this.initReject = (err) => { clearTimeout(timeoutId); reject(err); };

      try {
        const { worker, cleanup } = createStockfishWorker();
        this.worker = worker;
        this.cleanupBlob = cleanup;
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
        this.failPending(new EngineTimeoutError('Engine analysis timed out'));
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
    this.cleanupBlob?.();
    this.cleanupBlob = null;
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
