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

export default function GameLog({
  gameLog,
  connected,
  reconnecting
}: GameLogProps) {
  return (
    <div className="bg-white  border-2 border-black  overflow-hidden mb-4">
      <div className="border-b-2 border-accent p-2 font-bold bg-white  text-black  flex justify-between items-center font-neo uppercase">
        <span>Game Log</span>
        {reconnecting && (
          <span className="text-xs text-orange-600  font-normal flex items-center">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500 mr-1"></div>
            Reconnecting...
          </span>
        )}
        {!connected && !reconnecting && (
          <span className="text-xs text-red-600  font-normal">
            Disconnected
          </span>
        )}
      </div>
      <div
        className="h-96 overflow-y-auto p-2 bg-white "
        ref={(el) => {
          if (el) {
            el.scrollTop = el.scrollHeight;
          }
        }}
      >
        {gameLog.map((entry, index) => (
          <div key={index} className={`mb-1 p-1 border border-black  text-xs font-neo text-black  ${entry.type === 'system' ? 'bg-gray-100 ' :
            entry.type === 'move' ? 'bg-blue-100 ' :
              entry.type === 'engine' ? 'bg-yellow-100 ' :
                entry.type === 'phase' ? 'bg-white ' :
                  entry.type === 'error' ? 'bg-red-100 ' :
                    entry.type === 'game_over' ? 'bg-purple-100 ' :
                      entry.type === 'reconnecting' ? 'bg-orange-100 ' : ''
            }`}>
            {entry.player && <span className="font-bold">{entry.player}: </span>}
            {entry.message}
          </div>
        ))}
      </div>
    </div>
  );
}
