interface EngineStatusProps {
  phase: 'loading' | 'thinking' | 'opponent';
}

export default function EngineStatus({ phase }: EngineStatusProps) {
  const messages = {
    loading: 'Loading engine...',
    thinking: 'Analyzing position...',
    opponent: 'Opponent is choosing...',
  };

  return (
    <div className="flex items-center gap-3 border-4 border-black bg-white p-4 font-neo">
      <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-black" />
      <span className="font-bold uppercase">{messages[phase]}</span>
    </div>
  );
}
