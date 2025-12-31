import Timer from "~/components/Timer";
import { GamePhase, type GamePhaseType } from "~/types/generated";

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
  onLockInMove
}: GameControlsProps) {
  return (
    <>
      {/* Game Phase Indicator */}
      <div className="bg-white  border-2 border-black  p-4 mb-2">
        <Timer
          timeRemaining={timeRemaining}
          key={timeRemainingKey}
        />
        <div className="relative h-12 flex items-center">
          <div className="absolute w-full h-2 bg-gray-200  rounded-full"></div>

          {/* Phase Markers */}
          <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-black  ${gamePhase === GamePhase.TEAM1_SELECTION ? 'bg-accent' : 'bg-gray-300 '
            } flex items-center justify-center text-xs text-white font-bold ml-0`}>•</div>
          <div className="flex-grow h-2"></div>

          <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-black  ${gamePhase === GamePhase.TEAM1_COMPUTING ? 'bg-accent' : 'bg-gray-300 '
            } flex items-center justify-center text-xs text-white font-bold`}>•</div>
          <div className="flex-grow h-2"></div>

          <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-black  ${gamePhase === GamePhase.TEAM2_COMPUTING ? 'bg-accent' : 'bg-gray-300 '
            } flex items-center justify-center text-xs text-white font-bold mr-0`}>•</div>
          <div className="flex-grow h-2"></div>

          <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-black  ${gamePhase === GamePhase.TEAM2_SELECTION ? 'bg-accent' : 'bg-gray-300 '
            } flex items-center justify-center text-xs text-white font-bold`}>•</div>
        </div>
        <div className="flex justify-between text-xs mt-1 font-neo font-bold">
          <span className="bg-white text-black border border-black  px-2 py-1 uppercase">Select</span>
          <span className="bg-white text-black border border-black  px-2 py-1 uppercase">Compute</span>
          <span className="bg-black text-white border border-black  px-2 py-1 uppercase">Compute</span>
          <span className="bg-black text-white border border-black  px-2 py-1 uppercase">Select</span>
        </div>
      </div>

      {/* Lock In Move Button */}
      <div className="grid grid-cols-1 gap-2 mb-12">
        <button
          onClick={onLockInMove}
          className={`p-2 border-2 border-black  font-bold transition-colors duration-200 font-neo uppercase
            ${!connected || !selectedMove || lockedIn
              ? 'bg-gray-300  text-gray-500  cursor-not-allowed'
              : 'bg-white  text-black  hover:bg-accent hover:text-white'
            }`}
          disabled={!connected || !selectedMove || lockedIn}
        >
          Lock In Move
        </button>
      </div>
    </>
  );
}
