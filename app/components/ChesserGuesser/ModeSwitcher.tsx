// Mode Switcher Component
// Allows switching between Endless and Ranked modes

import { GameMode } from '~/utils/chesserGuesser/types';

interface ModeSwitcherProps {
  currentMode: GameMode;
  onModeChange: (mode: GameMode) => void;
  disabled?: boolean;
}

export function ModeSwitcher({ currentMode, onModeChange, disabled = false }: ModeSwitcherProps) {
  return (
    <div className="mb-4 border-4 border-black bg-white">
      <div className="grid h-12 grid-cols-2">
        <button
          onClick={() => !disabled && onModeChange('endless')}
          disabled={disabled}
          className={`font-neo md:text-md border-r-2 border-black text-xs font-bold tracking-wide uppercase transition-all duration-200 ${
            currentMode === 'endless' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
          } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} `}
        >
          Endless
        </button>
        <button
          onClick={() => !disabled && onModeChange('daily')}
          disabled={disabled}
          className={`font-neo md:text-md text-xs font-bold tracking-wide uppercase transition-all duration-200 ${
            currentMode === 'daily' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
          } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} `}
        >
          Ranked
        </button>
      </div>
    </div>
  );
}
