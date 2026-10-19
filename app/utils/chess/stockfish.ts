// Stockfish, shared by every chess tool: the pinned build, the browser worker,
// and reading the engine's output. The server-side runner is stockfish.server.ts.
//
// Engine assets come from unpkg's CDN. The 7.3 MB WASM exceeds API Gateway's
// 6 MB Lambda response cap, so it can't be served from our own origin without
// bypassing the Lambda; jsDelivr rejects the package for being >150 MB across
// its WASM variants, so unpkg is the path that works.

/** Pinned everywhere: browser workers and the server. Bumping it means new hashes in stockfish.server.ts. */
export const STOCKFISH_VERSION = '18.0.7';
/** The lite, single-threaded build: small, and needs no cross-origin isolation. */
export const STOCKFISH_BUILD = 'stockfish-18-lite-single';
export const STOCKFISH_CDN = `https://unpkg.com/stockfish@${STOCKFISH_VERSION}/bin`;

/** A score from the side to move: centipawns, or moves to mate (negative: being mated). */
export type EngineScore = { type: 'cp' | 'mate'; value: number };

/** The score on a UCI `info` line, if it has one. */
export function parseScore(line: string): EngineScore | null {
  const m = / score (cp|mate) (-?\d+)/.exec(line);
  return m ? { type: m[1] as 'cp' | 'mate', value: Number(m[2]) } : null;
}

/** A score as one comparable number: mates beat any centipawn value, sooner mates more. */
export function scoreValue(score: EngineScore): number {
  if (score.type === 'cp') return score.value;
  if (score.value > 0) return 100_000 - score.value;
  return -100_000 - score.value;
}

/**
 * A browser Web Worker running Stockfish. Workers can't be created directly
 * from a cross-origin URL, so this bootstraps a same-origin blob worker that
 * importScripts the CDN-hosted engine. Stockfish reads location.hash for the
 * wasm path: hash format is `#<wasm-url>`. Do NOT append `,worker`: it
 * short-circuits Stockfish's `||` entry chain before the ternary that wires up
 * onmessage and instantiates wasm, leaving the worker silent.
 */
export function createStockfishWorker(): { worker: Worker; cleanup: () => void } {
  const bootstrapSource = `importScripts(${JSON.stringify(`${STOCKFISH_CDN}/${STOCKFISH_BUILD}.js`)});`;
  const blob = new Blob([bootstrapSource], { type: 'application/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  const workerUrl = `${blobUrl}#${encodeURIComponent(`${STOCKFISH_CDN}/${STOCKFISH_BUILD}.wasm`)}`;
  const worker = new Worker(workerUrl);
  return { worker, cleanup: () => URL.revokeObjectURL(blobUrl) };
}
