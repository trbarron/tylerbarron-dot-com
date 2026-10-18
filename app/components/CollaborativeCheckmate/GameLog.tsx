type GameLogEntry = {
  type: 'system' | 'move' | 'engine' | 'phase' | 'error' | 'game_over' | 'reconnecting';
  message: string;
  player?: string;
};

interface GameLogProps {
  gameLog: GameLogEntry[];
  connected: boolean;
  reconnecting: boolean;
}

export default function GameLog({ gameLog, connected, reconnecting }: GameLogProps) {
  return (
    <div className="mb-4 overflow-hidden border-2 border-black bg-white">
      <div className="border-accent font-neo flex items-center justify-between border-b-2 bg-white p-2 font-bold text-black uppercase">
        <span>Game Log</span>
        {reconnecting && (
          <span className="flex items-center text-xs font-normal text-orange-600">
            <div className="mr-1 h-3 w-3 animate-spin rounded-full border-b-2 border-orange-500"></div>
            Reconnecting...
          </span>
        )}
        {!connected && !reconnecting && <span className="text-xs font-normal text-red-600">Disconnected</span>}
      </div>
      <div
        className="h-96 overflow-y-auto bg-white p-2"
        ref={(el) => {
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        }}
      >
        {gameLog.map((entry, index) => (
          <div
            key={index}
            className={`font-neo mb-1 border border-black p-1 text-xs text-black ${
              entry.type === 'system'
                ? 'bg-gray-100'
                : entry.type === 'move'
                  ? 'bg-blue-100'
                  : entry.type === 'engine'
                    ? 'bg-yellow-100'
                    : entry.type === 'phase'
                      ? 'bg-white'
                      : entry.type === 'error'
                        ? 'bg-red-100'
                        : entry.type === 'game_over'
                          ? 'bg-purple-100'
                          : entry.type === 'reconnecting'
                            ? 'bg-orange-100'
                            : ''
            }`}
          >
            {entry.player && <span className="font-bold">{entry.player}: </span>}
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
