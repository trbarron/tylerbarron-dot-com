import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import type { DrawShape } from 'chessground/draw';
import type { Key } from 'chessground/types';
import type { StockfishPool } from '~/utils/maiaDrills/stockfishPool';
import {
  advanceQueue,
  afterTry,
  extraGuesses,
  gradeByScores,
  gradeKnown,
  initialQueue,
  isAlsoGood,
  answeredRight,
  recordProgress,
  reveal as revealAnswer,
  type Answer,
  type Guess,
} from '~/utils/maiaDrills/drill';
import { loadProgress, saveProgress, type CardProgress } from '~/utils/maiaDrills/localStorage';
import { trackDrillAnswer } from '~/utils/maiaDrills/tracking';
import type { Deck } from '~/utils/maiaDrills/types';

const Chessboard = lazy(() => import('~/components/Chessboard'));

interface DrillProps {
  deckId: string;
  deck: Deck;
  onExit: () => void;
}

// Stable references: Chessboard re-creates the board whenever these change identity.
const NO_EVENTS = {};
const NO_SELECTABLE = {};
const NO_DRAWABLE = {};
const NO_SHAPES: DrawShape[] = [];

function arrow(uci: string, brush: string): DrawShape {
  return { orig: uci.slice(0, 2) as Key, dest: uci.slice(2, 4) as Key, brush };
}

function formatCp(cp: number): string {
  if (Math.abs(cp) >= 1000) return cp > 0 ? 'winning' : 'losing';
  return `${cp > 0 ? '+' : ''}${(cp / 100).toFixed(1)}`;
}

export default function Drill({ deckId, deck, onExit }: DrillProps) {
  const [queue, setQueue] = useState<number[]>([]);
  const [progress, setProgress] = useState<Record<string, CardProgress>>({});
  const [answer, setAnswer] = useState<Answer | null>(null);
  /** Wrong moves already tried on the current card. */
  const [misses, setMisses] = useState<Guess[]>([]);
  const [checking, setChecking] = useState(false);
  const [session, setSession] = useState({ attempted: 0, correct: 0 });
  const engineRef = useRef<StockfishPool | null>(null);

  useEffect(() => {
    const saved = loadProgress(deckId);
    setProgress(saved);
    setQueue(initialQueue(deck.cards, saved));
  }, [deckId, deck.cards]);

  useEffect(() => () => engineRef.current?.terminate(), []);

  const card = queue.length ? deck.cards[queue[0]] : null;

  const record = useCallback(
    (result: Answer) => {
      if (!card) return;
      const ok = answeredRight(result);
      setAnswer(result);
      trackDrillAnswer(result);
      setSession((s) => ({ attempted: s.attempted + 1, correct: s.correct + (ok ? 1 : 0) }));
      setProgress((prev) => {
        const next = recordProgress(prev, card.id, result);
        saveProgress(deckId, next);
        return next;
      });
    },
    [card, deckId]
  );

  const scoreGuess = async (
    fen: string,
    target: string,
    guess: string
  ): Promise<{ target: number; guess: number } | null> => {
    if (!engineRef.current) {
      const { StockfishPool } = await import('~/utils/maiaDrills/stockfishPool');
      engineRef.current = new StockfishPool(1);
    }
    try {
      await engineRef.current.ready();
      const scores = await engineRef.current.score(fen, [target, guess], deck.settings.depth);
      const t = scores.get(target);
      const g = scores.get(guess);
      return t === undefined || g === undefined ? null : { target: t, guess: g };
    } catch {
      return null;
    }
  };

  const handleMove = async (from: string, to: string) => {
    if (!card || answer || checking) return;
    const move = new Chess(card.fen).move({ from, to, promotion: 'q' });
    const guess: Guess = { uci: move.from + move.to + (move.promotion ?? ''), san: move.san };

    let graded = gradeKnown(card, guess);
    if (!graded) {
      // A third move: it might be just as good as the stronger player's choice.
      setChecking(true);
      graded = gradeByScores(guess, await scoreGuess(card.fen, card.target.uci, guess.uci));
      setChecking(false);
    }

    const outcome = afterTry(misses, graded.verdict, graded.guess);
    // A retry gives no hint: the board resets and the card stays up.
    if (outcome.kind === 'retry') setMisses(outcome.misses);
    else record(outcome.answer);
  };

  // The board rebuilds itself whenever its onMove changes identity, which on
  // every render made a miss flash the board. It gets one stable callback.
  const moveRef = useRef(handleMove);
  useEffect(() => {
    moveRef.current = handleMove;
  });
  const onBoardMove = useCallback((from: string, to: string) => void moveRef.current(from, to), []);

  const reveal = () => record(revealAnswer(misses));

  const next = () => {
    if (!answer) return;
    setQueue((q) => advanceQueue(q, answer, () => initialQueue(deck.cards, progress)));
    setAnswer(null);
    setMisses([]);
  };

  const shapes = useMemo(() => {
    if (!card || !answer) return NO_SHAPES;
    const list = [arrow(card.played.uci, 'red'), arrow(card.target.uci, 'green')];
    for (const g of extraGuesses(card, answer)) {
      list.push(arrow(g.uci, isAlsoGood(answer, g) ? 'blue' : 'yellow'));
    }
    return list;
  }, [card, answer]);

  if (!card) return null;

  const orientation = card.color === 'w' ? 'white' : 'black';
  const moveNumber = Math.floor(card.ply / 2) + 1;
  const moveLabel = `${moveNumber}${card.color === 'w' ? '.' : '…'}`;
  const mastered = deck.cards.filter((c) => progress[c.id]?.last === 'correct').length;

  const verdictText = (a: Answer): string => {
    if (a.verdict === 'correct') return a.firstTry ? 'Correct — that’s the stronger move.' : 'Got it on the second try.';
    if (a.verdict === 'also-good') {
      return a.firstTry
        ? 'Not the same move, but Stockfish rates it just as well. Counts.'
        : 'Not the same move, but Stockfish rates it just as well. Got it on the second try.';
    }
    return a.verdict === 'wrong' ? 'Not quite.' : 'Here’s the answer.';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 font-neo text-sm">
        <button onClick={onExit} className="font-bold uppercase tracking-wide text-gray-600 hover:text-black">
          ← Deck
        </button>
        <span className="font-mono text-gray-700">
          {session.correct}/{session.attempted} this session · {mastered}/{deck.cards.length} last answered right
        </span>
      </div>

      <div className="border-4 border-black bg-white">
        <div className="border-b-4 border-black bg-black px-4 py-3 text-white">
          <p className="font-neo text-sm font-bold uppercase tracking-wide">
            {orientation} to play · move {moveLabel}
          </p>
          <p className="font-neo text-xs text-white/70">
            What would a {card.targetElo} play? (You were {card.userElo}, vs {card.opponent} {card.oppElo})
          </p>
        </div>

        <div className="p-2 sm:p-4">
          <Suspense fallback={<div className="aspect-square w-full bg-gray-100" />}>
            {answer ? (
              <Chessboard
                key={`${card.id}-answer`}
                initialFen={card.fen}
                orientation={orientation}
                viewOnly
                movable={false}
                autoShapes={shapes}
                events={NO_EVENTS}
                selectable={NO_SELECTABLE}
                drawable={NO_DRAWABLE}
              />
            ) : (
              <Chessboard
                key="drill"
                initialFen={card.fen}
                // A miss, or the same card twice in a row, puts the pieces back.
                resetKey={`${session.attempted}-${misses.length}`}
                orientation={orientation}
                playableColor={orientation}
                onMove={onBoardMove}
                autoShapes={NO_SHAPES}
                events={NO_EVENTS}
                selectable={NO_SELECTABLE}
                drawable={NO_DRAWABLE}
              />
            )}
          </Suspense>
        </div>

        <div className="space-y-3 border-t-4 border-black p-4 font-neo text-black" aria-live="polite">
          {!answer && !checking && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-700">
                {misses.length ? 'Not that one. One more try.' : 'Make a move on the board.'}
              </p>
              <button
                onClick={reveal}
                className="border-2 border-black px-3 py-1 text-xs font-bold uppercase tracking-wide hover:bg-black hover:text-white"
              >
                Show answer
              </button>
            </div>
          )}
          {checking && <p className="text-sm">Checking your move with Stockfish…</p>}

          {answer && (
            <>
              <p
                // The words say whether it was right; no colour needed.
                className="text-lg font-extrabold text-black"
              >
                {verdictText(answer)}
              </p>
              <ul className="space-y-1 text-sm">
                <li>
                  <span className="inline-block w-3 bg-green-600">&nbsp;</span>{' '}
                  A {card.targetElo} plays <strong className="font-mono">{card.target.san}</strong>{' '}
                  <span className="text-gray-600">(Maia {Math.round(card.target.prob * 100)}%, eval {formatCp(card.evalTarget)})</span>
                </li>
                <li>
                  <span className="inline-block w-3 bg-red-600">&nbsp;</span>{' '}
                  In the game you played <strong className="font-mono">{card.played.san}</strong>{' '}
                  <span className="text-gray-600">(eval {formatCp(card.evalPlayed)})</span>
                </li>
                {extraGuesses(card, answer).map((g) => (
                  <li key={g.uci}>
                    <span className={`inline-block w-3 ${isAlsoGood(answer, g) ? 'bg-blue-600' : 'bg-yellow-500'}`}>&nbsp;</span>{' '}
                    You tried <strong className="font-mono">{g.san}</strong>
                    {g.eval !== undefined && <span className="text-gray-600"> (eval {formatCp(g.eval)})</span>}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {card.gameUrl ? (
                  <a
                    href={card.gameUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline hover:no-underline"
                  >
                    Open the game ↗
                  </a>
                ) : (
                  <span />
                )}
                <button
                  onClick={next}
                  className="border-4 border-black bg-black px-5 py-2 font-extrabold uppercase tracking-wide text-white hover:bg-white hover:text-black"
                >
                  Next card →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
