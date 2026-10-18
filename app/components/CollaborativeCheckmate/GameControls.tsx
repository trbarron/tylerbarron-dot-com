import Timer from '~/components/Timer';
import { GamePhase, type GamePhaseType } from '~/types/generated';

interface GameControlsProps {
  gamePhase: GamePhaseType;
  timeRemaining: number;
  timeRemainingKey: string | null;
  connected: boolean;
  selectedMove: boolean;
  lockedIn: boolean;
  onLockInMove: () => void;
}

export default function GameControls({
  gamePhase,
  timeRemaining,
  timeRemainingKey,
  connected,
  selectedMove,
  lockedIn,
  onLockInMove,
}: GameControlsProps) {
  return (
    <>
      {/* Game Phase Indicator */}
      <div className="mb-2 border-2 border-black bg-white p-4">
        <Timer timeRemaining={timeRemaining} key={timeRemainingKey} />
        <div className="relative flex h-12 items-center">
          <div className="absolute h-2 w-full rounded-full bg-gray-200"></div>

          {/* Phase Markers */}
          <div
            className={`relative z-10 h-6 w-6 rounded-full border-2 border-black ${
              gamePhase === GamePhase.TEAM1_SELECTION ? 'bg-accent' : 'bg-gray-300'
            } ml-0 flex items-center justify-center text-xs font-bold text-white`}
          >
            •
          </div>
          <div className="h-2 flex-grow"></div>

          <div
            className={`relative z-10 h-6 w-6 rounded-full border-2 border-black ${
              gamePhase === GamePhase.TEAM1_COMPUTING ? 'bg-accent' : 'bg-gray-300'
            } flex items-center justify-center text-xs font-bold text-white`}
          >
            •
          </div>
          <div className="h-2 flex-grow"></div>

          <div
            className={`relative z-10 h-6 w-6 rounded-full border-2 border-black ${
              gamePhase === GamePhase.TEAM2_COMPUTING ? 'bg-accent' : 'bg-gray-300'
            } mr-0 flex items-center justify-center text-xs font-bold text-white`}
          >
            •
          </div>
          <div className="h-2 flex-grow"></div>

          <div
            className={`relative z-10 h-6 w-6 rounded-full border-2 border-black ${
              gamePhase === GamePhase.TEAM2_SELECTION ? 'bg-accent' : 'bg-gray-300'
            } flex items-center justify-center text-xs font-bold text-white`}
          >
            •
          </div>
        </div>
        <div className="font-neo mt-1 flex justify-between text-xs font-bold">
          <span className="border border-black bg-white px-2 py-1 text-black uppercase">Select</span>
          <span className="border border-black bg-white px-2 py-1 text-black uppercase">Compute</span>
          <span className="border border-black bg-black px-2 py-1 text-white uppercase">Compute</span>
          <span className="border border-black bg-black px-2 py-1 text-white uppercase">Select</span>
        </div>
      </div>

      {/* Lock In Move Button */}
      <div className="mb-12 grid grid-cols-1 gap-2">
        <button
          onClick={onLockInMove}
          className={`font-neo border-2 border-black p-2 font-bold uppercase transition-colors duration-200 ${
            !connected || !selectedMove || lockedIn
              ? 'cursor-not-allowed bg-gray-300 text-gray-500'
              : 'hover:bg-accent bg-white text-black hover:text-white'
          }`}
          disabled={!connected || !selectedMove || lockedIn}
        >
          Lock In Move
        </button>
      </div>
    </>
  );
}
