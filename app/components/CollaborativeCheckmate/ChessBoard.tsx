import { Suspense, lazy } from 'react';
import type { ChessboardProps } from '~/components/Chessboard';
import { GamePhase, type GamePhaseType } from '~/types/generated';

const Chessboard = lazy(() => import('~/components/Chessboard'));

interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  gamePhase: GamePhaseType;
  playerTeam: number | null;
  lockedIn: boolean;
  chessboardEvents: ChessboardProps['events'];
  chessboardDrawable: ChessboardProps['drawable'];
}

export default function ChessBoard({
  fen,
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
        className={`mb-4 rounded p-2 transition-all duration-300 ${
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
              <div className="font-neo flex aspect-square w-full items-center justify-center rounded bg-gray-100 text-black">
                Loading chessboard...
              </div>
            }
          >
            <Chessboard
              initialFen={fen}
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
