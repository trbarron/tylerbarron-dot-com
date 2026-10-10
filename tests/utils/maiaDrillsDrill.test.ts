/**
 * Maia Drills flashcard rules: grading, the two-try rule (a first miss gives
 * no hint, a second reveals), first-try-only scoring, and card order.
 */

import { describe, it, expect } from 'vitest';
import {
  ALSO_GOOD_MARGIN,
  MAX_TRIES,
  REQUEUE_GAP,
  advanceQueue,
  afterTry,
  extraGuesses,
  gradeByScores,
  gradeKnown,
  initialQueue,
  isAlsoGood,
  passed,
  recordProgress,
  reveal,
  type Answer,
  type Guess,
} from '~/utils/maiaDrills/drill';
import type { DrillCard } from '~/utils/maiaDrills/types';

const card = {
  id: 'g1-20',
  target: { uci: 'f1b5', san: 'Bb5', prob: 0.4 },
  played: { uci: 'a2a3', san: 'a3' },
  evalTarget: 45,
  evalPlayed: -150,
} as DrillCard;

const target: Guess = { uci: 'f1b5', san: 'Bb5' };
const gameMove: Guess = { uci: 'a2a3', san: 'a3' };
const other: Guess = { uci: 'h2h3', san: 'h3' };

describe('grading', () => {
  it('knows the target is right and the game move is wrong, with their stored evals', () => {
    expect(gradeKnown(card, target)).toEqual({ verdict: 'correct', guess: { ...target, eval: card.evalTarget } });
    expect(gradeKnown(card, gameMove)).toEqual({ verdict: 'wrong', guess: { ...gameMove, eval: card.evalPlayed } });
  });

  it('defers any other move to Stockfish', () => {
    expect(gradeKnown(card, other)).toBeNull();
  });

  it('accepts a move within the margin, or better, as also good', () => {
    expect(gradeByScores(other, { target: 50, guess: 50 - ALSO_GOOD_MARGIN })).toEqual({
      verdict: 'also-good',
      guess: { ...other, eval: 50 - ALSO_GOOD_MARGIN },
    });
    expect(gradeByScores(other, { target: 50, guess: 90 }).verdict).toBe('also-good');
    expect(gradeByScores(other, { target: 50, guess: 49 - ALSO_GOOD_MARGIN }).verdict).toBe('wrong');
  });

  it('counts an engine failure as wrong rather than guessing', () => {
    expect(gradeByScores(other, null)).toEqual({ verdict: 'wrong', guess: other });
  });
});

describe('two tries', () => {
  it('allows exactly two tries', () => {
    expect(MAX_TRIES).toBe(2);
  });

  it('turns a first miss into a retry, with nothing revealed', () => {
    const outcome = afterTry([], 'wrong', gameMove);
    expect(outcome).toEqual({ kind: 'retry', misses: [gameMove] });
  });

  it('reveals after the second miss, keeping both tries', () => {
    const outcome = afterTry([gameMove], 'wrong', other);
    expect(outcome).toEqual({
      kind: 'done',
      answer: { verdict: 'wrong', guesses: [gameMove, other], firstTry: false },
    });
  });

  it('finishes immediately on a first-try hit', () => {
    expect(afterTry([], 'correct', target)).toEqual({
      kind: 'done',
      answer: { verdict: 'correct', guesses: [target], firstTry: true },
    });
  });

  it('marks a second-try hit as not first try', () => {
    const outcome = afterTry([gameMove], 'correct', target);
    expect(outcome.kind === 'done' && outcome.answer.firstTry).toBe(false);
  });

  it('treats Show answer as a reveal that never passes', () => {
    expect(reveal([gameMove])).toEqual({ verdict: 'revealed', guesses: [gameMove], firstTry: false });
    expect(passed(reveal([]))).toBe(false);
  });
});

describe('scoring', () => {
  const answer = (verdict: Answer['verdict'], firstTry: boolean): Answer => ({ verdict, guesses: [], firstTry });

  it('passes only first-try correct or also-good answers', () => {
    expect(passed(answer('correct', true))).toBe(true);
    expect(passed(answer('also-good', true))).toBe(true);
    expect(passed(answer('correct', false))).toBe(false);
    expect(passed(answer('also-good', false))).toBe(false);
    expect(passed(answer('wrong', true))).toBe(false);
  });

  it('records seen, correct and last result per card', () => {
    let progress = recordProgress({}, 'c1', answer('correct', true));
    expect(progress.c1).toEqual({ seen: 1, correct: 1, last: 'correct' });
    progress = recordProgress(progress, 'c1', answer('correct', false));
    expect(progress.c1).toEqual({ seen: 2, correct: 1, last: 'wrong' });
  });
});

describe('card order', () => {
  const cards = ['a', 'b', 'c', 'd'].map((id) => ({ id }) as DrillCard);
  const noShuffle = () => 0.999999; // Fisher–Yates with j = i keeps the order.

  it('puts cards not yet answered right first', () => {
    const progress = { a: { seen: 1, correct: 1, last: 'correct' as const } };
    expect(initialQueue(cards, progress, noShuffle)).toEqual([1, 2, 3, 0]);
  });

  it('drops a passed card from the queue', () => {
    const pass: Answer = { verdict: 'correct', guesses: [], firstTry: true };
    expect(advanceQueue([0, 1, 2], pass, () => [])).toEqual([1, 2]);
  });

  it(`brings a missed card back after ${REQUEUE_GAP} others`, () => {
    const miss: Answer = { verdict: 'wrong', guesses: [], firstTry: false };
    expect(advanceQueue([0, 1, 2, 3, 4, 5], miss, () => [])).toEqual([1, 2, 3, 0, 4, 5]);
    expect(advanceQueue([0, 1], miss, () => [])).toEqual([1, 0]);
    expect(advanceQueue([0], miss, () => [])).toEqual([0]);
  });

  it('requeues a second-try hit like a miss', () => {
    const late: Answer = { verdict: 'correct', guesses: [], firstTry: false };
    expect(advanceQueue([0, 1], late, () => [])).toEqual([1, 0]);
  });

  it('starts a new round when the last card passes', () => {
    const pass: Answer = { verdict: 'correct', guesses: [], firstTry: true };
    expect(advanceQueue([2], pass, () => [3, 1])).toEqual([3, 1]);
  });
});

describe('answer display', () => {
  it('lists only tries that aren’t already drawn, once each', () => {
    const answer: Answer = { verdict: 'wrong', guesses: [gameMove, other], firstTry: false };
    expect(extraGuesses(card, answer)).toEqual([other]);
    const twice: Answer = { verdict: 'wrong', guesses: [other, { ...other }], firstTry: false };
    expect(extraGuesses(card, twice)).toHaveLength(1);
  });

  it('marks only the accepted final try as also good', () => {
    const first = { ...other, uci: 'g2g3' };
    const answer: Answer = { verdict: 'also-good', guesses: [first, other], firstTry: false };
    expect(isAlsoGood(answer, other)).toBe(true);
    expect(isAlsoGood(answer, first)).toBe(false);
  });
});
