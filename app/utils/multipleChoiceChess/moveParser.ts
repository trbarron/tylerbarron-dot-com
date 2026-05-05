import { Chess } from "chess.js";

export interface CandidateMove {
  uci: string;   // "e2e4"
  san: string;   // "e4"
  rank: 1 | 2 | 4 | 6;
}

// Parse MultiPV lines from Stockfish output.
// Keeps the latest depth line seen for each multipv rank.
export function parseMultiPV(
  lines: string[],
  fen: string,
): CandidateMove[] {
  const chess = new Chess(fen);
  const best: Map<number, string> = new Map(); // rank → uci

  for (const line of lines) {
    // info depth N multipv M score cp V pv MOVE ...
    const match = line.match(/multipv\s+(\d+).*?\bpv\s+(\S+)/);
    if (!match) continue;
    const rank = Number(match[1]);
    const uci = match[2];
    best.set(rank, uci);
  }

  const targets = [1, 2, 4, 6] as const;
  const result: CandidateMove[] = [];

  for (const rank of targets) {
    const uci = best.get(rank);
    if (!uci) continue;

    try {
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const promotion = uci.length === 5 ? uci[4] : undefined;

      const tempChess = new Chess(fen);
      const moveResult = tempChess.move({ from, to, promotion });
      if (!moveResult) continue;

      result.push({ uci, san: moveResult.san, rank });
      chess.load(fen); // reset for next iteration
    } catch {
      // skip malformed UCI
    }
  }

  return result;
}

// Shuffle an array in place (Fisher-Yates)
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
