// Mode Indicator Component
// Small badge showing current game mode

import { GameMode } from '~/utils/chesserGuesser/types';

interface ModeIndicatorProps {
  mode: GameMode;
}

export function ModeIndicator({ mode }: ModeIndicatorProps) {
  return (
    <div
      className={`font-neo w-full border-4 px-3 py-2 text-center text-sm font-bold uppercase ${
        mode === 'daily' ? 'bg-accent border-accent text-white' : 'border-black bg-white text-black'
      } `}
    >
      {mode === 'daily' ? '🏆 Ranked' : '♾️ Endless Mode'}
    </div>
  );
}
