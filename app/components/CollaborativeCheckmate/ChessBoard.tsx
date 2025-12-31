import { Suspense, lazy } from "react";
import { GamePhase, type GamePhaseType } from "~/types/generated";

const Chessboard = lazy(() => import('~/components/Chessboard'));

interface ChessBoardProps {
  fen: string;
  orientation: 'white' | 'black';
  gamePhase: GamePhaseType;
  playerTeam: number | null;
  lockedIn: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chessboardEvents: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chessboardDrawable: any;
}

export default function ChessBoard({
  fen,
  orientation,
  gamePhase,
  playerTeam,
  lockedIn,
  chessboardEvents,
  chessboardDrawable
}: ChessBoardProps) {
  return (
    <div className="mb-4">
      <div className={`mb-4 p-2 rounded transition-all duration-300 ${(gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1)
        ? 'bg-white'
        : (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2)
          ? 'bg-black'
          : 'bg-transparent'
        }`}>
        <div className="relative">
          {/* Turn indicator banner */}
          {((gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1) ||
            (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2))}
          <Suspense fallback={<div className="w-full aspect-square bg-gray-100  rounded flex items-center justify-center text-black  font-neo">Loading chessboard...</div>}>
            <Chessboard
              initialFen={fen}
              orientation={orientation}
              viewOnly={!((gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1) ||
                (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2)) || lockedIn}
              movable={!!playerTeam && ((gamePhase === GamePhase.TEAM1_SELECTION && playerTeam === 1) ||
                (gamePhase === GamePhase.TEAM2_SELECTION && playerTeam === 2)) && !lockedIn}
              events={chessboardEvents}
              drawable={chessboardDrawable}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
