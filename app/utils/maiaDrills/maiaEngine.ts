// Maia-3 running in a Web Worker via onnxruntime-web: on the GPU (WebGPU) where
// the browser offers one, otherwise on the CPU (WASM).
//
// Neither the runtime nor the model ships with the site: ORT's wasm (11–22 MB)
// and the model (~44 MB) both exceed API Gateway's 6 MB Lambda response cap,
// so the worker pulls ORT from jsDelivr and the model from Hugging Face. The
// model is kept in Cache Storage after the first download. Both hosts send
// CORS headers. Like the Stockfish worker, this is a same-origin blob worker
// that importScripts the CDN build, because a Worker can't be constructed from
// a cross-origin URL.
//
// Client-only: import this from effects/handlers, never at module scope of an
// SSR-rendered file.

import { Chess } from 'chess.js';
import { isHandheld } from './device';
import {
  MAIA_MOVE_VOCAB,
  MAIA_TOKENS_PER_POSITION,
  decodePolicy,
  writeTokens,
} from './maiaEncoding';

// 1.30 or later: 1.22's WebGPU backend computes this graph wrong (its top move
// matched the CPU's on 4 of 48 positions; 1.30 matches on all of them).
const ORT_VERSION = '1.30.0';
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
// Pinned to a commit, not `main`: the repo is a third party's, and a new upload
// there shouldn't silently change what Maia predicts (or break it). The cache is
// keyed by this URL, so changing the pin re-downloads once.
const MAIA_MODEL_REVISION = '923df9a2e9396b54a09b168bb858ebbd5e5b76bc';
export const MAIA_MODEL_URL = `https://huggingface.co/bqrio/maia3-onnx/resolve/${MAIA_MODEL_REVISION}/maia3-23m.fp16.onnx`;
const MODEL_CACHE = 'maia-drills-models-v1';

/**
 * Positions per inference. The GPU gains from big batches; the CPU doesn't
 * (~68 ms a position either way), and there a 64 batch grows the WASM heap to
 * ~227 MiB against ~157 MiB for 16, which matters on a phone.
 */
const BATCH = { webgpu: 64, wasm: 16 } as const;

export type MaiaBackend = 'webgpu' | 'wasm';

// The runtime bundle is chosen inside the worker, once it knows whether a GPU
// adapter exists: the WebGPU build drags a bigger wasm (it also carries the CPU
// fallback), so CPU-only browsers get the plain one.
const WORKER_SOURCE = `
const ORT_BASE = ${JSON.stringify(ORT_BASE)};
let session = null;

async function hasGpu() {
  try {
    return !!(self.navigator && navigator.gpu && (await navigator.gpu.requestAdapter()));
  } catch (e) {
    return false;
  }
}

function loadRuntime(gpu) {
  importScripts(ORT_BASE + (gpu ? 'ort.webgpu.min.js' : 'ort.wasm.min.js'));
  ort.env.wasm.wasmPaths = ORT_BASE;
  // Threads need cross-origin isolation, which this site doesn't set.
  ort.env.wasm.numThreads = 1;
}

// 'basic': the fp16 graph trips a fusion bug at higher optimization levels.
function createSession(bytes, provider) {
  return ort.InferenceSession.create(bytes, {
    executionProviders: [provider],
    graphOptimizationLevel: 'basic',
  });
}

async function loadModel(url, cacheName) {
  let cache = null;
  try { cache = await caches.open(cacheName); } catch (e) { /* private mode */ }
  const hit = cache && await cache.match(url);
  if (hit) return new Uint8Array(await hit.arrayBuffer());

  const res = await fetch(url);
  if (!res.ok) throw new Error('Model download failed (' + res.status + ')');
  const total = Number(res.headers.get('Content-Length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0, lastPct = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const pct = total ? Math.floor(received / total * 100) : -1;
    if (pct !== lastPct) { lastPct = pct; postMessage({ type: 'progress', received, total }); }
  }
  const bytes = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) { bytes.set(c, pos); pos += c.length; }
  if (cache) {
    try { await cache.put(url, new Response(bytes)); } catch (e) { /* quota: just re-download next time */ }
  }
  return bytes;
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      const gpu = msg.allowGpu && (await hasGpu());
      // A failed GPU start can't fall back to the CPU in this worker: once ORT's
      // initWasm() fails it refuses every later call ("previous call to
      // 'initWasm()' failed"), which is what iOS hit. So report it, and the
      // page starts a fresh CPU-only worker.
      const gpuFailed = (err) => postMessage({ type: 'gpu-failed', message: (err && err.message) || String(err) });
      try {
        loadRuntime(gpu);
      } catch (err) {
        if (gpu) return gpuFailed(err);
        throw err;
      }
      const bytes = await loadModel(msg.modelUrl, msg.cacheName);
      if (gpu) {
        try {
          session = await createSession(bytes, 'webgpu');
        } catch (err) {
          return gpuFailed(err);
        }
        postMessage({ type: 'ready', backend: 'webgpu' });
      } else {
        session = await createSession(bytes, 'wasm');
        // One full-size batch now, so the heap reaches its peak while Maia is
        // the only engine loaded. Out of memory then fails here, at startup,
        // rather than halfway through the games.
        const n = msg.cpuBatch;
        await session.run({
          tokens: new ort.Tensor('float32', new Float32Array(n * 768), [n, 64, 12]),
          elo_self: new ort.Tensor('float32', new Float32Array(n).fill(1500), [n]),
          elo_oppo: new ort.Tensor('float32', new Float32Array(n).fill(1500), [n]),
        });
        postMessage({ type: 'ready', backend: 'wasm' });
      }
    } else if (msg.type === 'infer') {
      const n = msg.n;
      const out = await session.run({
        tokens: new ort.Tensor('float32', new Float32Array(msg.tokens), [n, 64, 12]),
        elo_self: new ort.Tensor('float32', new Float32Array(msg.eloSelf), [n]),
        elo_oppo: new ort.Tensor('float32', new Float32Array(msg.eloOppo), [n]),
      });
      const logits = new Float32Array(out.logits_move.data);
      postMessage({ type: 'result', id: msg.id, logits: logits.buffer }, [logits.buffer]);
    }
  } catch (err) {
    postMessage({ type: 'error', id: msg.id, message: (err && err.message) || String(err) });
  }
};
`;

export interface MaiaQuery {
  fen: string;
  /** Legal moves in UCI, real board coordinates. */
  legal: string[];
  eloSelf: number;
  eloOppo: number;
}

export interface MaiaPrediction {
  uci: string;
  prob: number;
}

export interface DownloadProgress {
  received: number;
  total: number;
}

/**
 * Positions with an unambiguous human answer, run once on the GPU before it's
 * trusted. A driver or runtime bug produces confident nonsense rather than an
 * error, so "did it load" isn't enough; these catch that and fall back to the CPU.
 */
const CANARIES: { fen: string; expect: string[] }[] = [
  { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', expect: ['e2e4', 'd2d4'] },
  { fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', expect: ['e7e5', 'c7c5', 'e7e6', 'd7d5'] },
  { fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', expect: ['a1a8'] },
];

export class MaiaEngine {
  private worker: Worker | null = null;
  private blobUrl: string | null = null;
  private nextId = 0;
  private pending = new Map<number, { resolve: (l: Float32Array) => void; reject: (e: Error) => void }>();
  private onProgress?: (p: DownloadProgress) => void;
  /** Resolves to where inference runs once the model is loaded and checked. */
  ready: Promise<MaiaBackend>;
  private backend: MaiaBackend | null = null;

  constructor(opts: { onProgress?: (p: DownloadProgress) => void; allowGpu?: boolean } = {}) {
    this.onProgress = opts.onProgress;
    this.ready = this.start(opts.allowGpu ?? !isHandheld())
      .then(async (backend) => {
        if (backend === 'wasm') return backend;
        if (backend === 'webgpu') {
          if (await this.passesCanaries()) return backend;
          console.warn('Maia: GPU results failed the sanity check; using the CPU');
        }
        this.stopWorker();
        // Without the GPU the worker only ever reports 'wasm'.
        return this.start(false) as Promise<MaiaBackend>;
      })
      .then((backend) => (this.backend = backend));
  }

  /** 'gpu-failed': the GPU didn't start, and this worker can't fall back (see the worker). */
  private start(allowGpu: boolean): Promise<MaiaBackend | 'gpu-failed'> {
    this.blobUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'application/javascript' }));
    const worker = new Worker(this.blobUrl);
    this.worker = worker;

    return new Promise((resolveReady, rejectReady) => {
      worker.onmessage = (e) => {
        const msg = e.data;
        if (msg.type === 'progress') this.onProgress?.({ received: msg.received, total: msg.total });
        else if (msg.type === 'ready') resolveReady(msg.backend);
        else if (msg.type === 'gpu-failed') {
          console.warn('Maia: WebGPU unavailable, using the CPU:', msg.message);
          resolveReady('gpu-failed');
        }
        else if (msg.type === 'result') {
          this.pending.get(msg.id)?.resolve(new Float32Array(msg.logits));
          this.pending.delete(msg.id);
        } else if (msg.type === 'error') {
          const err = new Error(msg.message);
          if (msg.id === undefined) rejectReady(err);
          else {
            this.pending.get(msg.id)?.reject(err);
            this.pending.delete(msg.id);
          }
        }
      };
      worker.onerror = (e) => {
        const err = new Error(`Maia worker error: ${e.message || 'unknown'}`);
        rejectReady(err);
        this.rejectPending(err);
      };
      worker.postMessage({ type: 'init', modelUrl: MAIA_MODEL_URL, cacheName: MODEL_CACHE, allowGpu, cpuBatch: BATCH.wasm });
    });
  }

  private async passesCanaries(): Promise<boolean> {
    try {
      const results = await this.run(
        CANARIES.map(({ fen }) => ({
          fen,
          legal: new Chess(fen).moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? '')),
          eloSelf: 1500,
          eloOppo: 1500,
        }))
      );
      return results.every((r, i) => CANARIES[i].expect.includes(r[0]?.uci));
    } catch {
      return false;
    }
  }

  private infer(tokens: Float32Array, eloSelf: Float32Array, eloOppo: Float32Array, n: number): Promise<Float32Array> {
    const worker = this.worker;
    if (!worker) return Promise.reject(new Error('Maia stopped'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage(
        { type: 'infer', id, n, tokens: tokens.buffer, eloSelf: eloSelf.buffer, eloOppo: eloOppo.buffer },
        [tokens.buffer, eloSelf.buffer, eloOppo.buffer]
      );
    });
  }

  /** Maia's move distribution for each query, most likely first. */
  async predict(queries: MaiaQuery[]): Promise<MaiaPrediction[][]> {
    await this.ready;
    return this.run(queries);
  }

  private async run(queries: MaiaQuery[]): Promise<MaiaPrediction[][]> {
    const results: MaiaPrediction[][] = [];

    // Before `ready` resolves this is the GPU canary check.
    const size = BATCH[this.backend ?? 'webgpu'];
    for (let start = 0; start < queries.length; start += size) {
      const batch = queries.slice(start, start + size);
      const n = batch.length;
      const tokens = new Float32Array(n * MAIA_TOKENS_PER_POSITION);
      batch.forEach((q, i) => writeTokens(q.fen, tokens, i * MAIA_TOKENS_PER_POSITION));

      const logits = await this.infer(
        tokens,
        Float32Array.from(batch.map((q) => q.eloSelf)),
        Float32Array.from(batch.map((q) => q.eloOppo)),
        n
      );
      batch.forEach((q, i) => results.push(decodePolicy(logits, i * MAIA_MOVE_VOCAB, q.fen, q.legal)));
    }
    return results;
  }

  private rejectPending(err: Error) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  private stopWorker() {
    this.worker?.terminate();
    this.worker = null;
    if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
    this.blobUrl = null;
    this.rejectPending(new Error('Maia stopped'));
  }

  terminate() {
    this.stopWorker();
  }
}
