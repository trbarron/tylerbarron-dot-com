// Endless Mode Prompt Component
// Encourages users to try ranked mode after playing endless

interface EndlessModePromptProps {
  onTryRanked: () => void;
  onDismiss: () => void;
  gamesPlayed: number;
}

export function EndlessModePrompt({ onTryRanked, onDismiss, gamesPlayed }: EndlessModePromptProps) {
  return (
    <div className="bg-accent text-white border-4 border-black  p-4 mb-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-neo font-bold uppercase text-md mb-2">
            Try Ranked!
          </h3>
          <p className="font-neo text-sm">
            You've played {gamesPlayed} endless games. Ready to compete on the daily leaderboard?
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onDismiss}
            className="bg-white text-black border-2 border-black px-4 py-2 font-neo font-bold uppercase text-sm hover:bg-gray-100 transition-colors"
          >
            Maybe Later
          </button>
          <button
            onClick={onTryRanked}
            className="bg-black text-white border-2 border-black px-4 py-2 font-neo font-bold uppercase text-sm hover:bg-gray-900 transition-colors"
          >
            Yep
          </button>
        </div>
      </div>
    </div>
  );
}
