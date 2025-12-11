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
    <div className="bg-white  border-4 border-black  mb-4">
      <div className="grid grid-cols-2 h-12">
        <button
          onClick={() => !disabled && onModeChange('endless')}
          disabled={disabled}
          className={`
            font-neo font-bold uppercase tracking-wide text-xs md:text-md
            transition-all duration-200 border-r-2 border-black 
            ${currentMode === 'endless'
              ? 'bg-black text-white  '
              : 'bg-white text-black   hover:bg-gray-100 '
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
              ? 'bg-black text-white  '
              : 'bg-white text-black   hover:bg-gray-100 '
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
