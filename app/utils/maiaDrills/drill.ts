// The flashcard rules, kept out of the component so they can be tested:
// grading a move, the two-try rule, scoring, and the order cards come up in.
// See docs/maia-drills.md, "Drill grading".

import type { CardProgress } from './localStorage';
import type { DrillCard } from './types';

export type Verdict = 'correct' | 'also-good' | 'wrong' | 'revealed';

export interface Guess {
  uci: string;
  san: string;
  /** Stockfish's eval of the move (cp, from the mover's side), when known. */
  eval?: number;
}

export interface Answer {
  verdict: Verdict;
  /** Every move tried on this card, in order. */
  guesses: Guess[];
  /** Right or not, whether it came on the first try; shown in the verdict and sent to analytics. */
  firstTry: boolean;
}

/**
 * An eval for display, in the usual convention: + is good for White, − for
 * Black. Cards store evals from the mover's side, which is what grading
 * compares, so a Black card's are flipped. Past ±10 (mates clamp to ±1000)
 * it names the winning side instead of a number.
 */
export function formatEval(moverCp: number, mover: 'w' | 'b'): string {
  const cp = mover === 'w' ? moverCp : -moverCp;
  if (Math.abs(cp) >= 1000) return cp > 0 ? 'White is winning' : 'Black is winning';
  return `eval ${cp > 0 ? '+' : ''}${(cp / 100).toFixed(1)}`;
}

/** A move within this many cp of the stronger player's choice counts too. */
export const ALSO_GOOD_MARGIN = 30;
/** Tries per card. A miss before the last one just resets the board, with no hint. */
export const MAX_TRIES = 2;

/**
 * Grade a move that doesn't need an engine: the target is right, the game move
 * is wrong (both already scored by the deck's analysis). Anything else returns
 * null and has to be scored by Stockfish, then graded with `gradeByScores`.
 */
export function gradeKnown(card: DrillCard, guess: Guess): { verdict: Verdict; guess: Guess } | null {
  if (guess.uci === card.target.uci) return { verdict: 'correct', guess: { ...guess, eval: card.evalTarget } };
  if (guess.uci === card.played.uci) return { verdict: 'wrong', guess: { ...guess, eval: card.evalPlayed } };
  return null;
}

/**
 * Grade a move from one Stockfish search of it and the target, so the two are
 * compared like for like. `null` means it couldn't say, which counts as wrong.
 */
export function gradeByScores(
  guess: Guess,
  scores: { target: number; guess: number } | null
): { verdict: Verdict; guess: Guess } {
  if (!scores) return { verdict: 'wrong', guess };
  return {
    verdict: scores.target - scores.guess <= ALSO_GOOD_MARGIN ? 'also-good' : 'wrong',
    guess: { ...guess, eval: scores.guess },
  };
}

export type TryOutcome = { kind: 'retry'; misses: Guess[] } | { kind: 'done'; answer: Answer };

/** What happens after a graded try, given the misses already made on this card. */
export function afterTry(misses: Guess[], verdict: Verdict, guess: Guess): TryOutcome {
  const guesses = [...misses, guess];
  if (verdict === 'wrong' && guesses.length < MAX_TRIES) return { kind: 'retry', misses: guesses };
  return { kind: 'done', answer: { verdict, guesses, firstTry: misses.length === 0 } };
}

export function reveal(misses: Guess[]): Answer {
  return { verdict: 'revealed', guesses: misses, firstTry: false };
}

/** Answered right, on either try: the stronger move, or one Stockfish rates as good. Drives the stats. */
export function answeredRight(answer: Answer): boolean {
  return answer.verdict === 'correct' || answer.verdict === 'also-good';
}

export function recordProgress(
  progress: Record<string, CardProgress>,
  cardId: string,
  answer: Answer
): Record<string, CardProgress> {
  const ok = answeredRight(answer);
  const old = progress[cardId] ?? { seen: 0, correct: 0, last: 'wrong' as const };
  return {
    ...progress,
    [cardId]: { seen: old.seen + 1, correct: old.correct + (ok ? 1 : 0), last: ok ? 'correct' : 'wrong' },
  };
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Card indices to drill: not-yet-right cards first, then the rest, each group shuffled. */
export function initialQueue(
  cards: DrillCard[],
  progress: Record<string, CardProgress>,
  random: () => number = Math.random
): number[] {
  const indices = cards.map((_, i) => i);
  const due = indices.filter((i) => progress[cards[i].id]?.last !== 'correct');
  const rest = indices.filter((i) => progress[cards[i].id]?.last === 'correct');
  return [...shuffle(due, random), ...shuffle(rest, random)];
}

/**
 * The queue after answering its head. Each card comes up once per round, right
 * or wrong: the positions rarely recur, so seeing a miss again a few cards
 * later would test memory, not judgment. An empty queue starts a new round,
 * which puts the misses first.
 */
export function advanceQueue(queue: number[], refill: () => number[]): number[] {
  const rest = queue.slice(1);
  return rest.length ? rest : refill();
}

/** Tried moves not already drawn as the target or the game move, without repeats. */
export function extraGuesses(card: DrillCard, answer: Answer): Guess[] {
  const seen = new Set([card.target.uci, card.played.uci]);
  return answer.guesses.filter((g) => {
    if (seen.has(g.uci)) return false;
    seen.add(g.uci);
    return true;
  });
}

/** The final guess of an also-good answer is the one Stockfish accepted. */
export function isAlsoGood(answer: Answer, guess: Guess): boolean {
  return answer.verdict === 'also-good' && guess === answer.guesses[answer.guesses.length - 1];
}
