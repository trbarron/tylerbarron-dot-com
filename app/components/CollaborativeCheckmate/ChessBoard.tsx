import { Suspense, lazy } from 'react';
import type { DrawShape } from 'chessground/draw';
import type { ChessboardProps } from '~/components/Chessboard';
import { GamePhase, type GamePhaseType } from '~/utils/collaborativeCheckmate/types';

const Chessboard = lazy(() => import('~/components/Chessboard'));

interface ChessBoardProps {
  fen: string;
  /** Change to put the pieces back on `fen`, e.g. after a move is sent. */
  resetKey: string;
  /** Arrows: the last move, and your pending choice. */
  autoShapes: DrawShape[];
  orientation: 'white' | 'black';
  gamePhase: GamePhaseType;
  playerTeam: number | null;
  lockedIn: boolean;
  chessboardEvents: ChessboardProps['events'];
  chessboardDrawable: ChessboardProps['drawable'];
}

export default function ChessBoard({
  fen,
  resetKey,
  autoShapes,
  orientation,
  gamePhase,
  playerTeam,
  lockedIn,
  chessboardEvents,
  chessboardDrawable,
}: ChessBoardProps) {
  return (
    <div className="mb-4">
      <div
        className={`mb-4 p-2 transition-all duration-300 ${
          gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1
            ? 'bg-white'
            : gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2
              ? 'bg-black'
              : 'bg-transparent'
        }`}
      >
        <div className="relative">
          {/* Turn indicator banner */}
          {(gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1) ||
            (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2)}
          <Suspense
            fallback={
              <div className="font-neo flex aspect-square w-full items-center justify-center bg-gray-100 text-black">
                Loading chessboard...
              </div>
            }
          >
            <Chessboard
              initialFen={fen}
              resetKey={resetKey}
              autoShapes={autoShapes}
              orientation={orientation}
              viewOnly={
                !(
                  (gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1) ||
                  (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2)
                ) || lockedIn
              }
              movable={
                !!playerTeam &&
                ((gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1) ||
                  (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2)) &&
                !lockedIn
              }
              events={chessboardEvents}
              drawable={chessboardDrawable}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
