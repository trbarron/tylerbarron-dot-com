// The primary input during playback — large fixed button on mobile, Space key on desktop.

import { useEffect, useState } from 'react';

type FeedbackState = 'idle' | 'correct' | 'false_positive';

interface BlunderButtonProps {
  onFlag: () => void;
  disabled: boolean;
  lastFlagResult: 'correct' | 'false_positive' | null;
}

export function BlunderButton({ onFlag, disabled, lastFlagResult }: BlunderButtonProps) {
  const [feedback, setFeedback] = useState<FeedbackState>('idle');

  // Flash feedback when a flag result comes in
  useEffect(() => {
    if (!lastFlagResult) return;
    setFeedback(lastFlagResult === 'correct' ? 'correct' : 'false_positive');
    const timer = setTimeout(() => setFeedback('idle'), 600);
    return () => clearTimeout(timer);
  }, [lastFlagResult]);

  const bgClass =
    feedback === 'correct' ? 'bg-green-500 border-green-700 text-white' :
    feedback === 'false_positive' ? 'bg-red-500 border-red-700 text-white' :
    disabled ? 'bg-gray-200 border-gray-400 text-gray-400 cursor-not-allowed' :
    'bg-white border-black text-black hover:bg-black hover:text-white active:scale-95';

  return (
    <>
      {/* Desktop inline button */}
      <button
        onClick={() => !disabled && onFlag()}
        disabled={disabled}
        className={`
          hidden md:block w-full border-4 px-6 py-5 font-neo font-black text-xl uppercase tracking-wide
          transition-all duration-100 mt-4
          ${bgClass}
        `}
        aria-label="Flag this move as a blunder"
      >
        {feedback === 'correct' ? 'Blunder!' :
         feedback === 'false_positive' ? 'Not a blunder' :
         disabled ? 'Already flagged' :
         'Blunder'}
      </button>

      {/* Mobile fixed button — always visible, thumb-friendly, ≥ 64pt tap target */}
      <div className="md:hidden fixed bottom-6 left-0 right-0 z-50 flex justify-center px-6">
        <button
          onClick={() => !disabled && onFlag()}
          disabled={disabled}
          className={`
            w-full max-w-sm border-4 px-6 min-h-16 font-neo font-black text-xl uppercase tracking-wide
            transition-all duration-100 shadow-[4px_4px_0px_rgba(0,0,0,0.3)]
            ${bgClass}
          `}
          aria-label="Flag this move as a blunder"
        >
          {feedback === 'correct' ? 'Blunder!' :
           feedback === 'false_positive' ? 'Not a blunder' :
           disabled ? 'Already flagged' :
           'Blunder!'}
        </button>
      </div>
    </>
  );
}
