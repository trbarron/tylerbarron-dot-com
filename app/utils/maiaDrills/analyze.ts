// The analysis pipeline: for each of the user's moves, ask Maia what a player
// `delta` points stronger would have played, and when that differs, ask
// Stockfish whether the difference is worth at least `thresholdCp`.
// See docs/maia-drills.md, "Error definition".
//
// Maia runs one batched inference per game; Stockfish jobs for that game are
// queued on the pool and drained while Maia moves on to the next game.

import { Chess } from 'chess.js';
import type { MaiaEngine, MaiaQuery } from './maiaEngine';
import type { StockfishPool } from './stockfishPool';
import { MAIA_ELO_RANGE, type AnalysisSettings, type DeckStats, type DrillCard, type SourceGame } from './types';

/** Stockfish jobs allowed in flight before Maia waits for the pool to catch up. */
const MAX_OUTSTANDING_JOBS = 48;

/** One game's progress through the two engines. */
export interface GameProgress {
  /** The user's moves Maia predicts for. */
  positions: number;
  positionsDone: number;
  /** Where Maia disagreed, each scored by Stockfish. Known once Maia is done. */
  checks: number;
  checksDone: number;
  maiaDone: boolean;
}

export interface AnalysisProgress {
  /** Games fully analyzed: through Maia, and every Stockfish check settled. */
  gamesDone: number;
  gamesTotal: number;
  /**
   * The oldest game still in progress: the next one `gamesDone` will count.
   * Maia can run a few games ahead of Stockfish, so this is the one holding
   * up the count, not the one Maia is on.
   */
  current: GameProgress | null;
  cards: number;
  skippedNoRating: number;
}

export interface AnalysisResult {
  cards: DrillCard[];
  stats: DeckStats;
  skippedNoRating: number;
  cancelled: boolean;
}

interface Candidate {
  fen: string;
  ply: number;
  played: { uci: string; san: string };
}

export function clampElo(elo: number): number {
  return Math.max(MAIA_ELO_RANGE.min, Math.min(MAIA_ELO_RANGE.max, Math.round(elo)));
}

function uciOf(move: { from: string; to: string; promotion?: string }): string {
  return move.from + move.to + (move.promotion ?? '');
}

/** The user's moves in a game, with the position each was played from. */
export function userMoves(game: SourceGame, skipMoves: number): Candidate[] {
  const chess = game.startFen ? new Chess(game.startFen) : new Chess();
  const out: Candidate[] = [];
  for (let ply = 0; ply < game.san.length; ply++) {
    const fen = chess.fen();
    const moveNumber = Number(fen.split(' ')[5]);
    let move;
    try {
      move = chess.move(game.san[ply]);
    } catch {
      break; // Corrupt move list: keep what replayed cleanly.
    }
    if (move.color === game.userColor && moveNumber >= skipMoves + 1) {
      out.push({ fen, ply, played: { uci: uciOf(move), san: move.san } });
    }
  }
  return out;
}

export function legalUci(fen: string): string[] {
  return new Chess(fen).moves({ verbose: true }).map(uciOf);
}

function sanOf(fen: string, uci: string): string {
  return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
}

export async function analyzeGames(
  games: SourceGame[],
  settings: AnalysisSettings,
  engines: { maia: MaiaEngine; stockfish: StockfishPool },
  opts: { signal?: AbortSignal; onProgress?: (p: AnalysisProgress) => void }
): Promise<AnalysisResult> {
  const cards: DrillCard[] = [];
  const stats: DeckStats = { games: 0, positions: 0, disagreements: 0 };
  const progress: AnalysisProgress = {
    gamesDone: 0,
    gamesTotal: games.length,
    current: null,
    cards: 0,
    skippedNoRating: 0,
  };
  // Games in order; skipped ones go straight to finished.
  const states: (GameProgress & { finished: boolean })[] = [];
  let oldest = 0;
  const report = () => {
    while (oldest < states.length && states[oldest].finished) oldest++;
    const s = states[oldest];
    const current = s
      ? { positions: s.positions, positionsDone: s.positionsDone, checks: s.checks, checksDone: s.checksDone, maiaDone: s.maiaDone }
      : null;
    opts.onProgress?.({ ...progress, current });
  };
  const outstanding: Promise<void>[] = [];
  const aborted = () => opts.signal?.aborted ?? false;

  for (const game of games) {
    if (aborted()) break;

    const userIsWhite = game.userColor === 'w';
    const userElo = userIsWhite ? game.whiteElo : game.blackElo;
    if (userElo === null) {
      states.push({ positions: 0, positionsDone: 0, checks: 0, checksDone: 0, maiaDone: true, finished: true });
      progress.skippedNoRating++;
      progress.gamesDone++;
      report();
      continue;
    }
    const oppElo = (userIsWhite ? game.blackElo : game.whiteElo) ?? userElo;
    const targetElo = clampElo(userElo + settings.delta);

    const candidates = userMoves(game, settings.skipMoves);
    const queries: MaiaQuery[] = candidates.map((c) => ({
      fen: c.fen,
      legal: legalUci(c.fen),
      eloSelf: targetElo,
      eloOppo: clampElo(oppElo),
    }));
    const state = { positions: queries.length, positionsDone: 0, checks: 0, checksDone: 0, maiaDone: false, finished: false };
    states.push(state);
    report();
    const predictions = queries.length
      ? await engines.maia.predict(queries, (done) => {
          state.positionsDone = done;
          report();
        })
      : [];
    if (aborted()) break;
    state.maiaDone = true;

    stats.games++;
    stats.positions += candidates.length;

    const gameJobs: Promise<void>[] = [];
    candidates.forEach((c, i) => {
      const top = predictions[i][0];
      // Only-move positions can't disagree; neither can Maia matching the user.
      if (!top || top.uci === c.played.uci) return;
      stats.disagreements++;
      state.checks++;

      const job = engines.stockfish
        .score(c.fen, [top.uci, c.played.uci], settings.depth)
        .then((scores) => {
          const evalTarget = scores.get(top.uci);
          const evalPlayed = scores.get(c.played.uci);
          if (evalTarget === undefined || evalPlayed === undefined) return;
          if (evalTarget - evalPlayed < settings.thresholdCp) return;

          cards.push({
            id: `${game.id}-${c.ply}`,
            fen: c.fen,
            ply: c.ply,
            color: game.userColor,
            played: c.played,
            target: { uci: top.uci, san: sanOf(c.fen, top.uci), prob: Math.round(top.prob * 1000) / 1000 },
            evalPlayed,
            evalTarget,
            userElo,
            targetElo,
            oppElo,
            opponent: userIsWhite ? game.black : game.white,
            gameUrl: game.url,
            playedAt: game.playedAt,
            speed: game.speed,
          });
          progress.cards = cards.length;
        })
        .catch(() => {
          // A stopped or timed-out search just doesn't produce a card.
        })
        .finally(() => {
          state.checksDone++;
          report();
        });
      gameJobs.push(job);
    });

    // A game counts as done once its Stockfish checks are, so one bar covers
    // both engines: Maia alone would race ahead of the real progress.
    report();
    const gameDone = Promise.all(gameJobs).then(() => {
      state.finished = true;
      progress.gamesDone++;
      report();
    });
    outstanding.push(gameDone);

    // Backpressure: don't let Maia race hundreds of games ahead of Stockfish.
    while (engines.stockfish.pending > MAX_OUTSTANDING_JOBS && !aborted()) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  if (aborted()) engines.stockfish.terminate();
  await Promise.allSettled(outstanding);

  cards.sort((a, b) => b.evalTarget - b.evalPlayed - (a.evalTarget - a.evalPlayed));
  return { cards, stats, skippedNoRating: progress.skippedNoRating, cancelled: aborted() };
}
