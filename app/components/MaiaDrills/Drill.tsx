import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { uciArrow } from '~/utils/chess/moves';
import type { DrawShape } from 'chessground/draw';
import type { StockfishPool } from '~/utils/maiaDrills/stockfishPool';
import {
  advanceQueue,
  analysisUrl,
  afterTry,
  extraGuesses,
  formatEval,
  gradeByScores,
  gradeKnown,
  gradingMoves,
  initialQueue,
  isAlsoGood,
  answeredRight,
  recordProgress,
  reveal as revealAnswer,
  withSearchEvals,
  type Answer,
  type Guess,
} from '~/utils/maiaDrills/drill';
import { loadProgress, saveProgress, type CardProgress } from '~/utils/maiaDrills/localStorage';
import { trackDrillAnswer } from '~/utils/maiaDrills/tracking';
import DeckCleared from './DeckCleared';
import type { Deck } from '~/utils/maiaDrills/types';
import Button from '~/components/Button';

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

export default function Drill({ deckId, deck, onExit }: DrillProps) {
  const [queue, setQueue] = useState<number[]>([]);
  const [progress, setProgress] = useState<Record<string, CardProgress>>({});
  const [answer, setAnswer] = useState<Answer | null>(null);
  /** Wrong moves already tried on the current card. */
  const [misses, setMisses] = useState<Guess[]>([]);
  const [checking, setChecking] = useState(false);
  const [session, setSession] = useState({ attempted: 0, correct: 0 });
  /** Chose to keep drilling a cleared deck; reset when a miss un-clears it. */
  const [reviewing, setReviewing] = useState(false);
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
    [card, deckId],
  );

  const scoreMoves = async (fen: string, moves: string[]): Promise<Map<string, number> | null> => {
    if (!engineRef.current) {
      const { StockfishPool } = await import('~/utils/maiaDrills/stockfishPool');
      engineRef.current = new StockfishPool(1);
    }
    try {
      await engineRef.current.ready();
      return await engineRef.current.score(fen, moves, deck.settings.depth);
    } catch {
      return null;
    }
  };

  const handleMove = async (from: string, to: string) => {
    if (!card || answer || checking) return;
    const move = new Chess(card.fen).move({ from, to, promotion: 'q' });
    const guess: Guess = { uci: move.from + move.to + (move.promotion ?? ''), san: move.san };

    let graded = gradeKnown(card, guess);
    let scores: Map<string, number> | null = null;
    if (!graded) {
      // A third move: it might be just as good as the stronger player's choice.
      // One search scores it with the target, the game move and any earlier
      // try, so every eval the answer shows agrees with the verdict.
      setChecking(true);
      scores = await scoreMoves(card.fen, gradingMoves(card, [...misses, guess]));
      const target = scores?.get(card.target.uci);
      const mine = scores?.get(guess.uci);
      graded = gradeByScores(
        guess,
        target === undefined || mine === undefined ? null : { target, guess: mine },
        deck.settings.alsoGoodWin,
      );
      setChecking(false);
    }

    const outcome = afterTry(misses, graded.verdict, graded.guess);
    // A retry gives no hint: the board resets and the card stays up.
    if (outcome.kind === 'retry') setMisses(outcome.misses);
    else record(scores ? withSearchEvals(outcome.answer, card, scores) : outcome.answer);
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
    setQueue((q) => advanceQueue(q, () => initialQueue(deck.cards, progress)));
    setAnswer(null);
    setMisses([]);
  };

  const resetProgress = () => {
    saveProgress(deckId, {});
    setProgress({});
    setQueue(initialQueue(deck.cards, {}));
    setReviewing(false);
  };

  const solved = deck.cards.filter((c) => progress[c.id]?.last === 'correct').length;
  const allSolved = deck.cards.length > 0 && solved === deck.cards.length;
  useEffect(() => {
    if (!allSolved) setReviewing(false);
  }, [allSolved]);

  const shapes = useMemo(() => {
    if (!card || !answer) return NO_SHAPES;
    const list = [uciArrow(card.played.uci, 'red'), uciArrow(card.target.uci, 'green')];
    for (const g of extraGuesses(card, answer)) {
      list.push(uciArrow(g.uci, isAlsoGood(answer, g) ? 'blue' : 'yellow'));
    }
    return list;
  }, [card, answer]);

  if (!card) return null;

  const orientation = card.color === 'w' ? 'white' : 'black';
  const moveNumber = Math.floor(card.ply / 2) + 1;
  const moveLabel = `${moveNumber}${card.color === 'w' ? '.' : '…'}`;

  const verdictText = (a: Answer): string => {
    if (a.verdict === 'correct') return 'Nice! That’s the stronger move';
    if (a.verdict === 'also-good') return 'Not what we were going for but also strong. Nice';
    return a.verdict === 'wrong' ? 'Nope' : 'Here’s the answer';
  };

  const header = (
    <div className="font-neo flex flex-wrap items-center justify-between gap-2 text-sm">
      <button onClick={onExit} className="font-bold tracking-wide text-gray-600 uppercase hover:text-black">
        ← Deck
      </button>
      <span className="font-mono text-gray-700">
        {session.correct}/{session.attempted} this session · {solved}/{deck.cards.length} solved
      </span>
    </div>
  );

  // Once the last answer is dismissed, and on opening a deck that's already cleared.
  if (allSolved && !reviewing && !answer) {
    return (
      <div className="space-y-4">
        {header}
        <DeckCleared
          cardCount={deck.cards.length}
          onReset={resetProgress}
          onReview={() => setReviewing(true)}
          onExit={onExit}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <div className="border-4 border-black bg-white">
        <div className="border-b-4 border-black bg-black px-4 py-3 text-white">
          <p className="font-neo text-sm font-bold tracking-wide uppercase">
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

        <div className="font-neo space-y-3 border-t-4 border-black p-4 text-black" aria-live="polite">
          {!answer && !checking && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-gray-700">{misses.length ? 'Nope. One more try' : 'Make a move'}</p>
              <Button size="sm" onClick={reveal}>
                Show answer
              </Button>
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
                  <span className="inline-block w-3 bg-green-600">&nbsp;</span> A {card.targetElo} plays{' '}
                  <strong className="font-mono">{card.target.san}</strong>{' '}
                  <span className="text-gray-600">
                    (Maia {Math.round(card.target.prob * 100)}%,{' '}
                    {formatEval(answer.evals?.target ?? card.evalTarget, card.color)})
                  </span>
                </li>
                <li>
                  <span className="inline-block w-3 bg-red-600">&nbsp;</span> In the game you played{' '}
                  <strong className="font-mono">{card.played.san}</strong>{' '}
                  <span className="text-gray-600">
                    ({formatEval(answer.evals?.played ?? card.evalPlayed, card.color)})
                  </span>
                </li>
                {extraGuesses(card, answer).map((g) => (
                  <li key={g.uci}>
                    <span className={`inline-block w-3 ${isAlsoGood(answer, g) ? 'bg-blue-600' : 'bg-yellow-500'}`}>
                      &nbsp;
                    </span>{' '}
                    You tried <strong className="font-mono">{g.san}</strong>
                    {g.eval !== undefined && <span className="text-gray-600"> ({formatEval(g.eval, card.color)})</span>}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <a
                    href={analysisUrl(card)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Analyze on Lichess ↗
                  </a>
                  {card.gameUrl && (
                    <a
                      href={card.gameUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      Open the game ↗
                    </a>
                  )}
                </div>
                <Button variant="primary" onClick={next}>
                  Next card →
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
