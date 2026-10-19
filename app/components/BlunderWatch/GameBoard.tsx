// Blunder Watch's playback board: the shared Chessboard, view-only, fed the
// position after `currentMoveIndex`. The board updates in place, so each step
// animates.

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';

const Chessboard = lazy(() => import('~/components/Chessboard'));

interface GameBoardProps {
  initialFen: string;
  moves: string[]; // full SAN move list
  currentMoveIndex: number; // -1 = initial position, 0+ = after that move played
  orientation: 'white' | 'black';
  isFastForward: boolean;
  missedBlunderAt?: number;
}

/** The position after `index` (−1: the start) and the move that led to it. */
function positionAt(initialFen: string, moves: string[], index: number): { fen: string; lastMove?: [string, string] } {
  const chess = new Chess(initialFen);
  let lastMove: [string, string] | undefined;
  for (let i = 0; i <= index && i < moves.length; i++) {
    const move = chess.move(moves[i]);
    lastMove = [move.from, move.to];
  }
  return { fen: chess.fen(), lastMove };
}

export function GameBoard({
  initialFen,
  moves,
  currentMoveIndex,
  orientation,
  isFastForward,
  missedBlunderAt,
}: GameBoardProps) {
  const [isFlashingRed, setIsFlashingRed] = useState(false);
  const { fen, lastMove } = useMemo(
    () => positionAt(initialFen, moves, currentMoveIndex),
    [initialFen, moves, currentMoveIndex],
  );

  // Flash red on missed blunder
  useEffect(() => {
    if (missedBlunderAt && missedBlunderAt > 0) {
      setIsFlashingRed(true);
      const timer = setTimeout(() => setIsFlashingRed(false), 500);
      return () => clearTimeout(timer);
    }
  }, [missedBlunderAt]);

  return (
    <div className="w-full">
      <div
        className={`mx-auto w-full max-w-2xl border-4 transition-colors duration-300 ${
          isFlashingRed ? 'border-red-500' : isFastForward ? 'border-yellow-400' : 'border-black'
        }`}
      >
        <Suspense fallback={<div className="aspect-square min-h-[300px] w-full bg-gray-100" />}>
          <Chessboard
            initialFen={fen}
            lastMove={lastMove}
            orientation={orientation}
            viewOnly
            movable={false}
            draggable={false}
            allowDrawing={false}
          />
        </Suspense>
      </div>
    </div>
  );
}
