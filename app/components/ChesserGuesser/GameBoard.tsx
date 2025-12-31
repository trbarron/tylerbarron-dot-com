import { Suspense, lazy } from "react";
import { ModeIndicator } from "./ModeIndicator";
import type { GameMode } from "~/utils/chesserGuesser/types";

const Chessboard = lazy(() => import('~/components/Chessboard'));

interface GameBoardProps {
  mode: GameMode;
  fen: string;
  orientation: "white" | "black";
  currentTurn: string;
  isReviewMode: boolean;
}

export default function GameBoard({
  mode,
  fen,
  orientation,
  currentTurn,
  isReviewMode,
}: GameBoardProps) {
  return (
    <>
      {/* Mode Indicator and Turn Indicator */}
      <div className="mb-4 flex gap-2 items-stretch">
        <div className="flex-grow">
          <ModeIndicator mode={mode} />
        </div>
        <div className={`border-2 border-black px-3 md:px-4 py-1 md:py-2 flex items-center justify-center ${
          currentTurn === 'White' ? 'bg-white text-black' : 'bg-black text-white'
        }`}>
          <span className="font-neo font-bold text-xs md:text-sm uppercase whitespace-nowrap">
            {currentTurn} to move
          </span>
        </div>
      </div>

      {/* Chessboard */}
      <Suspense fallback={
        <div className="w-full aspect-square bg-gray-100 rounded flex items-center justify-center text-black font-neo">
          Loading chessboard...
        </div>
      }>
        <Chessboard
          key={fen}
          initialFen={fen}
          movable={false}
          allowDrawing={!isReviewMode}
          orientation={orientation}
        />
      </Suspense>
    </>
  );
}
