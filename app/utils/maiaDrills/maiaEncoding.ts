// Input/output encoding for the Maia-3 ONNX model.
//
// Pure functions only (no chess engine, no ORT), so they run unchanged in the
// browser, in the inference worker's caller, and under vitest.
//
// Maia-3 always sees the board from the side to move: when Black is to move
// the position is flipped top-to-bottom and the piece colors swapped, and the
// move it returns has to be flipped back. The encoding matches the Maia
// platform's own frontend (CSSLab/maia-platform-frontend, src/lib/engine/tensor.ts).

/** Size of the policy head: 64×64 from-to pairs, then 256 promotions. */
export const MAIA_MOVE_VOCAB = 4352;

/** Tokens per position: 64 squares × 12 one-hot piece channels. */
export const MAIA_TOKENS_PER_POSITION = 64 * 12;

// White P,N,B,R,Q,K then black p,n,b,r,q,k.
const PIECE_CHANNELS = 'PNBRQKpnbrqk';

// Promotion entries are ordered q, r, b, n within each from-file/to-file pair.
const PROMOTION_PIECES = 'qrbn';

function squareIndex(square: string): number {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return rank * 8 + file;
}

function squareName(index: number): string {
  return 'abcdefgh'[index % 8] + (Math.floor(index / 8) + 1);
}

/** Flip a square top-to-bottom (e2 → e7). */
export function mirrorSquare(square: string): string {
  return square[0] + (9 - Number(square[1]));
}

/** Flip a UCI move top-to-bottom, keeping any promotion suffix. */
export function mirrorUci(uci: string): string {
  return mirrorSquare(uci.slice(0, 2)) + mirrorSquare(uci.slice(2, 4)) + uci.slice(4);
}

function swapCase(text: string): string {
  return text.replace(/[a-zA-Z]/g, (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()));
}

/**
 * Only the piece-placement field matters to Maia-3, so this mirrors that field
 * and nothing else: castling and en-passant never reach the tokens.
 */
function mirrorPlacement(placement: string): string {
  return placement.split('/').reverse().map(swapCase).join('/');
}

/**
 * Write one position's tokens into `out` at `offset` (in floats). The position
 * is mirrored first when Black is to move.
 */
export function writeTokens(fen: string, out: Float32Array, offset = 0): void {
  const [placement, turn] = fen.split(' ');
  const rows = (turn === 'b' ? mirrorPlacement(placement) : placement).split('/');

  for (let r = 0; r < 8; r++) {
    const rank = 7 - r;
    let file = 0;
    for (const char of rows[r]) {
      const empty = Number(char);
      if (empty) {
        file += empty;
        continue;
      }
      const channel = PIECE_CHANNELS.indexOf(char);
      if (channel >= 0) out[offset + (rank * 8 + file) * 12 + channel] = 1;
      file += 1;
    }
  }
}

/**
 * Policy index of a UCI move that is already in the model's frame (i.e. already
 * mirrored when Black is to move).
 */
export function vocabIndex(uci: string): number {
  const from = squareIndex(uci.slice(0, 2));
  const to = squareIndex(uci.slice(2, 4));
  if (uci.length === 4) return from * 64 + to;

  const piece = PROMOTION_PIECES.indexOf(uci[4]);
  return 4096 + (from % 8) * 32 + (to % 8) * 4 + piece;
}

/** Inverse of `vocabIndex`, in the model's frame. */
export function vocabMove(index: number): string {
  if (index < 4096) return squareName(Math.floor(index / 64)) + squareName(index % 64);
  const rel = index - 4096;
  const fromFile = 'abcdefgh'[Math.floor(rel / 32)];
  const toFile = 'abcdefgh'[Math.floor((rel % 32) / 4)];
  return `${fromFile}7${toFile}8${PROMOTION_PIECES[rel % 4]}`;
}

/**
 * Turn the raw move logits for one position into probabilities over the legal
 * moves, sorted most likely first. `legalUci` and the returned moves are in
 * real board coordinates; mirroring happens here.
 */
export function decodePolicy(
  logits: Float32Array,
  offset: number,
  fen: string,
  legalUci: string[]
): { uci: string; prob: number }[] {
  const black = fen.split(' ')[1] === 'b';
  const scored = legalUci.map((uci) => ({
    uci,
    logit: logits[offset + vocabIndex(black ? mirrorUci(uci) : uci)],
  }));

  const max = Math.max(...scored.map((m) => m.logit));
  const exps = scored.map((m) => Math.exp(m.logit - max));
  const total = exps.reduce((a, b) => a + b, 0);

  return scored
    .map((m, i) => ({ uci: m.uci, prob: exps[i] / total }))
    .sort((a, b) => b.prob - a.prob);
}
