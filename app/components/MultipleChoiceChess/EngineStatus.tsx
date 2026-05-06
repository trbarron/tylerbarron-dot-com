import { useEffect, useState } from "react";

interface EngineStatusProps {
  phase: 'loading' | 'thinking' | 'opponent';
  since?: number; // ms timestamp; if provided and phase is 'opponent', show elapsed time after a threshold
}

const ELAPSED_THRESHOLD_MS = 20_000;

export default function EngineStatus({ phase, since }: EngineStatusProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phase !== 'opponent' || since === undefined) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase, since]);

  const baseMessages = {
    loading: 'Loading engine...',
    thinking: 'Analyzing position...',
    opponent: 'Opponent is choosing...',
  };

  const elapsedMs = phase === 'opponent' && since !== undefined ? now - since : 0;
  const showElapsed = elapsedMs >= ELAPSED_THRESHOLD_MS;

  return (
    <div className="flex items-center gap-3 border-4 border-black bg-white p-4 font-neo">
      <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-black" />
      <div className="flex flex-col">
        <span className="font-bold uppercase">{baseMessages[phase]}</span>
        {showElapsed && (
          <span className="text-xs text-gray-500">
            Thinking for {Math.floor(elapsedMs / 1000)}s
          </span>
        )}
      </div>
    </div>
  );
}
