// Pre-game screen shown before playback begins

interface PreGameScreenProps {
  whiteElo: number;
  blackElo: number;
  blunderCount: number;
  onStart: () => void;
}

export function PreGameScreen({ whiteElo, blackElo, blunderCount, onStart }: PreGameScreenProps) {
  return (
    <div className="bg-white border-4 border-black p-8 mb-4">

      {/* Matchup */}
      <div className="flex items-center justify-center gap-12 mb-8">
        <div className="text-center">
          <div className="w-10 h-10 bg-white border-2 border-black mx-auto mb-2" />
          <p className="font-neo font-bold text-black text-sm">White</p>
          <p className="font-neo text-gray-400 text-xs">{whiteElo} Elo</p>
        </div>
        <div className="font-neo font-black text-gray-300 text-xl">vs</div>
        <div className="text-center">
          <div className="w-10 h-10 bg-black mx-auto mb-2" />
          <p className="font-neo font-bold text-black text-sm">Black</p>
          <p className="font-neo text-gray-400 text-xs">{blackElo} Elo</p>
        </div>
      </div>

      {/* Blunder count */}
      <div className="bg-yellow-400 border-2 border-black px-4 py-3 mb-8 text-center">
        <p className="font-neo text-sm uppercase tracking-wide text-black">
          There are <span className="font-black text-xl">{blunderCount}</span> White blunders in this game
        </p>
      </div>

      {/* How to play */}
      <div className="border-t-2 border-black pt-6 mb-8">
        <p className="font-neo font-bold text-black text-xs uppercase tracking-widest mb-3 text-center">How to play</p>
        <ul className="font-neo text-sm text-gray-700 space-y-1.5 max-w-sm mx-auto">
          <li>Watch the game play out automatically</li>
          <li>You are <strong>only looking for White's blunders</strong></li>
          <li>Press <kbd className="bg-black text-white px-1 font-mono text-xs">Space</kbd> or tap the button when White blunders</li>
          <li>React fast — speed determines your points</li>
          <li>False positives cost you 30 points</li>
        </ul>
      </div>

      <button
        onClick={onStart}
        className="w-full bg-black text-white px-6 py-4 font-neo font-black text-lg uppercase tracking-wide hover:bg-gray-800 transition-colors"
      >
        Start Game
      </button>
    </div>
  );
}
