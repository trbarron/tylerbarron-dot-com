// Mode Switcher Component
// Allows switching between Endless and Ranked modes

import { GameMode } from "~/utils/chesserGuesser/types";

interface ModeSwitcherProps {
  currentMode: GameMode;
  onModeChange: (mode: GameMode) => void;
  disabled?: boolean;
}

export function ModeSwitcher({ currentMode, onModeChange, disabled = false }: ModeSwitcherProps) {
  return (
    <div className="bg-white dark:bg-black border-4 border-black dark:!border-white mb-4">
      <div className="grid grid-cols-2 h-12">
        <button
          onClick={() => !disabled && onModeChange('endless')}
          disabled={disabled}
          className={`
            font-neo font-bold uppercase tracking-wide text-xs md:text-md
            transition-all duration-200 border-r-2 border-black dark:!border-white
            ${currentMode === 'endless'
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'bg-white text-black dark:bg-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          Endless
        </button>
        <button
          onClick={() => !disabled && onModeChange('daily')}
          disabled={disabled}
          className={`
            font-neo font-bold uppercase tracking-wide text-xs md:text-md
            transition-all duration-200
            ${currentMode === 'daily'
              ? 'bg-black text-white dark:bg-white dark:text-black'
              : 'bg-white text-black dark:bg-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-900'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          Ranked
        </button>
      </div>
    </div>
  );
}
