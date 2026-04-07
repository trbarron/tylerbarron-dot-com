// The primary input during playback — large fixed button on mobile, Space key on desktop.

import { useEffect, useRef, useState } from 'react';

type FeedbackState = 'idle' | 'correct' | 'false_positive';

interface BlunderButtonProps {
  onFlag: () => void;
  disabled: boolean;
  lastFlagResult: 'correct' | 'false_positive' | null;
  isPreGame?: boolean;
  /** Duration in ms for the current move — drives the countdown bar */
  moveTimeMs?: number;
  /** Changes each move so the countdown bar resets */
  moveKey?: number;
  /** Whether it's currently White's move (even ply) — only show timer + active state on White moves */
  isWhiteMove?: boolean;
  /** Whether playback is in fast-forward mode (cutscene) */
  isFastForward?: boolean;
}

function TimerBar({ durationMs, moveKey }: { durationMs: number; moveKey: number }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    // Reset to full width, then shrink to zero
    el.style.transition = 'none';
    el.style.width = '100%';

    // Force reflow so the reset takes effect before the transition starts
    el.offsetHeight;

    el.style.transition = `width ${durationMs}ms linear`;
    el.style.width = '0%';
  }, [durationMs, moveKey]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1.5">
      <div ref={barRef} className="h-full bg-black opacity-30" />
    </div>
  );
}

export function BlunderButton({ onFlag, disabled, lastFlagResult, isPreGame = false, moveTimeMs, moveKey = 0, isWhiteMove = true, isFastForward = false }: BlunderButtonProps) {
  const [feedback, setFeedback] = useState<FeedbackState>('idle');

  // Flash feedback when a flag result comes in, reset when it clears (next move)
  useEffect(() => {
    if (!lastFlagResult) {
      setFeedback('idle');
      return;
    }
    setFeedback(lastFlagResult === 'correct' ? 'correct' : 'false_positive');
    const timer = setTimeout(() => setFeedback('idle'), 600);
    return () => clearTimeout(timer);
  }, [lastFlagResult]);

  // During Black's move or fast-forward, show active style but no text/timer (cutscene)
  const isInactive = !isPreGame && (!isWhiteMove || isFastForward);

  const bgClass =
    isPreGame ? 'bg-black border-black text-white hover:bg-white hover:text-black' :
    feedback === 'correct' ? 'bg-black border-black text-white' :
    feedback === 'false_positive' ? 'bg-gray-200 border-black text-black' :
    disabled ? 'bg-gray-200 border-gray-200 text-gray-700 cursor-not-allowed' :
    'bg-black border-black text-white hover:bg-white hover:text-black active:scale-[0.98]';

  const buttonText =
    isPreGame ? 'START GAME' :
    feedback === 'correct' ? 'BLUNDER!' :
    feedback === 'false_positive' ? 'NOT A BLUNDER' :
    disabled ? 'ALREADY FLAGGED' :
    isInactive ? '\u00A0' :
    'BLUNDER';

  const isDisabled = !isPreGame && disabled;
  const showTimer = !isPreGame && !disabled && !isInactive && moveTimeMs != null && moveTimeMs > 0;

  return (
    <>
      {/* Desktop inline button */}
      <button
        onClick={() => !isDisabled && onFlag()}
        disabled={isDisabled}
        className={`
          relative overflow-hidden
          hidden md:block w-full border-4 px-6 py-5 font-neo font-black text-xl uppercase tracking-tighter
          transition-all duration-100 mt-4
          ${bgClass}
        `}
        aria-label={isPreGame ? 'Start the game' : 'Flag this move as a blunder'}
      >
        {buttonText}
        {showTimer && <TimerBar durationMs={moveTimeMs} moveKey={moveKey} />}
      </button>

      {/* Mobile: inline button (not fixed) to avoid overlap/scroll issues */}
      <button
        onClick={() => !isDisabled && onFlag()}
        disabled={isDisabled}
        className={`
          relative overflow-hidden
          md:hidden w-full border-4 px-6 min-h-[4rem] font-neo font-black text-xl uppercase tracking-tighter
          transition-all duration-100 mt-4
          ${bgClass}
        `}
        aria-label={isPreGame ? 'Start the game' : 'Flag this move as a blunder'}
      >
        {buttonText}
        {showTimer && <TimerBar durationMs={moveTimeMs} moveKey={moveKey} />}
      </button>
    </>
  );
}
