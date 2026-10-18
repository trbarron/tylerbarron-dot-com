// Stockfish on the server: the same WASM build the browser games load from
// unpkg (18 lite, single-threaded), run inside the Lambda. It isn't shipped in
// the Lambda: the first search in a container downloads the two files from
// unpkg, checks them against pinned hashes, and keeps them in /tmp. In dev and
// tests they come from the stockfish devDependency. See docs/deployment.md.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

// Keep in step with STOCKFISH_VERSION in the browser games' loader. Changing it
// means new hashes: shasum -a 256 node_modules/stockfish/bin/stockfish-18-lite-single.*
const VERSION = '18.0.7';
const ENGINE_NAME = 'stockfish-18-lite-single';
const SHA256 = {
  js: '2278005057f381491f1c9bb3e44c9f5920b3a00bef9759e33cc6582769a1f1fe',
  wasm: 'a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1',
};
const CDN = `https://unpkg.com/stockfish@${VERSION}/bin`;

/** From the side to move: centipawns, or moves to mate (negative: being mated). */
export type EngineScore = { type: 'cp' | 'mate'; value: number };

interface EmscriptenEngine {
  locateFile: (file: string) => string;
  listener?: (line: string) => void;
  _isReady?: () => boolean;
  ccall: (name: string, ret: null, types: string[], args: string[], opts: { async: boolean }) => void;
}

function localCopy(): { js: string; wasm: string } | null {
  const dir = path.join(process.cwd(), 'node_modules', 'stockfish');
  try {
    const { version } = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const js = path.join(dir, 'bin', `${ENGINE_NAME}.js`);
    const wasm = path.join(dir, 'bin', `${ENGINE_NAME}.wasm`);
    return version === VERSION && fs.existsSync(js) && fs.existsSync(wasm) ? { js, wasm } : null;
  } catch {
    return null;
  }
}

async function download(file: string, sha256: string, dest: string): Promise<void> {
  if (fs.existsSync(dest)) return;
  const res = await fetch(`${CDN}/${file}`);
  if (!res.ok) throw new Error(`Stockfish download failed: ${file} ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const got = createHash('sha256').update(bytes).digest('hex');
  if (got !== sha256) throw new Error(`Stockfish download rejected: ${file} has hash ${got}`);
  const tmp = `${dest}.${process.pid}.part`;
  fs.writeFileSync(tmp, bytes);
  fs.renameSync(tmp, dest);
}

/** Paths to the engine script and WASM, downloading them into /tmp the first time. */
async function engineFiles(): Promise<{ js: string; wasm: string }> {
  const local = localCopy();
  if (local) return local;
  const dir = path.join(os.tmpdir(), `stockfish-${VERSION}`);
  fs.mkdirSync(dir, { recursive: true });
  // .cjs: the Lambda's package.json is "type": "module", and the engine script is CommonJS.
  const js = path.join(dir, `${ENGINE_NAME}.cjs`);
  const wasm = path.join(dir, `${ENGINE_NAME}.wasm`);
  await Promise.all([download(`${ENGINE_NAME}.js`, SHA256.js, js), download(`${ENGINE_NAME}.wasm`, SHA256.wasm, wasm)]);
  return { js, wasm };
}

let enginePromise: Promise<EmscriptenEngine> | null = null;

function loadEngine(): Promise<EmscriptenEngine> {
  enginePromise ??= (async () => {
    const { js, wasm } = await engineFiles();
    const init = createRequire(import.meta.url)(js) as () => (e: EmscriptenEngine) => Promise<void>;
    const engine = { locateFile: (name: string) => (name.includes('.wasm') ? wasm : js) } as EmscriptenEngine;
    await init()(engine);
    while (engine._isReady && !engine._isReady()) await new Promise((r) => setTimeout(r, 10));
    return engine;
  })().catch((err) => {
    enginePromise = null;
    throw err;
  });
  return enginePromise;
}

function send(engine: EmscriptenEngine, cmd: string) {
  engine.ccall('command', null, ['string'], [cmd], { async: /^go\b/.test(cmd) });
}

// One engine per Lambda container, so searches take turns.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Evaluate a position for the side to move. Stops at `depth` or after
 * `movetimeMs`, whichever comes first; rejects if the engine hasn't answered
 * well after that.
 */
export function evaluate(fen: string, { depth = 18, movetimeMs = 1000 } = {}): Promise<EngineScore> {
  const run = async () => {
    const engine = await loadEngine();
    return new Promise<EngineScore>((resolve, reject) => {
      let score: EngineScore = { type: 'cp', value: 0 };
      const timeout = setTimeout(() => {
        engine.listener = undefined;
        send(engine, 'stop');
        reject(new Error('Stockfish timed out'));
      }, movetimeMs + 5000);
      engine.listener = (line: string) => {
        const m = /\bscore (cp|mate) (-?\d+)/.exec(line);
        if (m) score = { type: m[1] as 'cp' | 'mate', value: Number(m[2]) };
        if (line.startsWith('bestmove')) {
          clearTimeout(timeout);
          engine.listener = undefined;
          resolve(score);
        }
      };
      send(engine, 'ucinewgame');
      send(engine, `position fen ${fen}`);
      send(engine, `go depth ${depth} movetime ${movetimeMs}`);
    });
  };
  const result = queue.then(run, run);
  queue = result.catch(() => undefined);
  return result;
}

/** A score as one comparable number: mates beat any centipawn value, sooner mates more. */
export function scoreValue(score: EngineScore): number {
  if (score.type === 'cp') return score.value;
  if (score.value > 0) return 100_000 - score.value;
  return -100_000 - score.value;
}
