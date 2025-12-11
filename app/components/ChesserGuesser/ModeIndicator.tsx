// Mode Indicator Component
// Small badge showing current game mode

import { GameMode } from "~/utils/chesserGuesser/types";

interface ModeIndicatorProps {
  mode: GameMode;
}

export function ModeIndicator({ mode }: ModeIndicatorProps) {
  return (
    <div
      className={`
        w-full px-3 py-2 font-neo font-bold uppercase text-sm text-center
        border-4
        ${mode === 'daily'
          ? 'bg-accent text-white border-accent'
          : 'bg-white dark:bg-black text-black dark:text-white border-black dark:!border-white'
        }
      `}
    >
      {mode === 'daily' ? '🏆 Ranked' : '♾️ Endless Mode'}
    </div>
  );
}
