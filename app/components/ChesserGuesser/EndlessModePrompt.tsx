// Endless Mode Prompt Component
// Encourages users to try ranked mode after playing endless

interface EndlessModePromptProps {
  onTryRanked: () => void;
  onDismiss: () => void;
  gamesPlayed: number;
}

export function EndlessModePrompt({ onTryRanked, onDismiss, gamesPlayed }: EndlessModePromptProps) {
  return (
    <div className="bg-accent mb-4 border-4 border-black p-4 text-white">
      <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex-1">
          <h3 className="font-neo text-md mb-2 font-bold uppercase">Try Ranked!</h3>
          <p className="font-neo text-sm">
            You've played {gamesPlayed} endless games. Ready to compete on the daily leaderboard?
          </p>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <button
            onClick={onDismiss}
            className="font-neo border-2 border-black bg-white px-4 py-2 text-sm font-bold text-black uppercase transition-colors hover:bg-gray-100"
          >
            Maybe Later
          </button>
          <button
            onClick={onTryRanked}
            className="font-neo border-2 border-black bg-black px-4 py-2 text-sm font-bold text-white uppercase transition-colors hover:bg-gray-900"
          >
            Yep
          </button>
        </div>
      </div>
    </div>
  );
}
