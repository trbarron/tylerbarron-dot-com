// Endless Mode Prompt Component
// Encourages users to try ranked mode after playing endless

import Button from '~/components/Button';

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
          <Button size="sm" onClick={onDismiss}>
            Maybe Later
          </Button>
          <Button variant="primary" size="sm" onClick={onTryRanked}>
            Yep
          </Button>
        </div>
      </div>
    </div>
  );
}
