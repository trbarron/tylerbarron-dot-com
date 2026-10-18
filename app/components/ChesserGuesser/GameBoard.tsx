import { Suspense, lazy } from 'react';
import { ModeIndicator } from './ModeIndicator';
import type { GameMode } from '~/utils/chesserGuesser/types';

const Chessboard = lazy(() => import('~/components/Chessboard'));

interface GameBoardProps {
  mode: GameMode;
  fen: string;
  orientation: 'white' | 'black';
  currentTurn: string;
  isReviewMode: boolean;
}

export default function GameBoard({ mode, fen, orientation, currentTurn, isReviewMode }: GameBoardProps) {
  return (
    <>
      {/* Mode Indicator and Turn Indicator */}
      <div className="mb-4 flex items-stretch gap-2">
        <div className="flex-grow">
          <ModeIndicator mode={mode} />
        </div>
        <div
          className={`flex items-center justify-center border-2 border-black px-3 py-1 md:px-4 md:py-2 ${
            currentTurn === 'White' ? 'bg-white text-black' : 'bg-black text-white'
          }`}
        >
          <span className="font-neo text-xs font-bold whitespace-nowrap uppercase md:text-sm">
            {currentTurn} to move
          </span>
        </div>
      </div>

      {/* Chessboard */}
      <Suspense
        fallback={
          <div className="font-neo flex aspect-square w-full items-center justify-center rounded bg-gray-100 text-black">
            Loading chessboard...
          </div>
        }
      >
        <Chessboard key={fen} initialFen={fen} movable={false} allowDrawing={!isReviewMode} orientation={orientation} />
      </Suspense>
    </>
  );
}
