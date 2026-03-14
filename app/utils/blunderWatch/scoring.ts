// Pure scoring logic for Blunder Watch — used both client-side (live) and server-side (final validation)

import type { Flag, BlunderResult, BlunderOutcome, ScoreResult } from './types';
import { buildResultEmoji } from './resultEmoji';

const POINTS_FAST = 100;   // ≤ 500ms
const POINTS_MEDIUM = 75;  // 501–1000ms
const POINTS_SLOW = 50;    // 1001–2000ms
const PENALTY_FP = 30;     // false positive deduction

function reactionToOutcome(ms: number): BlunderOutcome {
  if (ms <= 500) return 'caught_fast';
  if (ms <= 1000) return 'caught_medium';
  return 'caught_slow';
}

function outcomeToPoints(outcome: BlunderOutcome): number {
  if (outcome === 'caught_fast') return POINTS_FAST;
  if (outcome === 'caught_medium') return POINTS_MEDIUM;
  if (outcome === 'caught_slow') return POINTS_SLOW;
  return 0;
}

export function calculateScore(
  flags: Flag[],
  blunderIndices: number[],
  evals: number[],
): ScoreResult {
  const blunderSet = new Set(blunderIndices);
  const flagMap = new Map<number, number>(); // moveIndex → reactionTimeMs
  for (const flag of flags) {
    // Only the first flag per move index is counted
    if (!flagMap.has(flag.moveIndex)) {
      flagMap.set(flag.moveIndex, flag.reactionTimeMs);
    }
  }

  let totalScore = 0;
  let blundersCaught = 0;
  let blundersMissed = 0;
  let falsePositives = 0;
  const blunderResults: BlunderResult[] = [];

  // Score each blunder
  for (const idx of blunderIndices) {
    const reactionMs = flagMap.get(idx);
    const evalBefore = evals[idx - 1] ?? 0;
    const evalAfter = evals[idx] ?? 0;

    if (reactionMs !== undefined) {
      const outcome = reactionToOutcome(reactionMs);
      const points = outcomeToPoints(outcome);
      totalScore += points;
      blundersCaught++;
      blunderResults.push({ moveIndex: idx, evalBefore, evalAfter, outcome, points, reactionTimeMs: reactionMs });
    } else {
      blundersMissed++;
      blunderResults.push({ moveIndex: idx, evalBefore, evalAfter, outcome: 'missed', points: 0 });
    }
  }

  // Penalise false positives
  for (const flag of flags) {
    if (!blunderSet.has(flag.moveIndex)) {
      falsePositives++;
      totalScore -= PENALTY_FP;
    }
  }

  // Sort results chronologically for the replay view
  blunderResults.sort((a, b) => a.moveIndex - b.moveIndex);

  const resultEmoji = buildResultEmoji(blunderResults);

  return { totalScore, blundersCaught, blundersMissed, falsePositives, blunderResults, resultEmoji };
}
