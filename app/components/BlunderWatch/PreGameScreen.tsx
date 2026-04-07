// Pre-game screen shown before playback begins

interface PreGameScreenProps {
  whiteElo: number;
  blackElo: number;
  blunderCount: number;
  onStart: () => void;
}

export function PreGameScreen({ whiteElo, blackElo, blunderCount, onStart }: PreGameScreenProps) {
  return (
    <div className="bg-white border-4 border-black p-8 mb-4 w-full">

      {/* Matchup */}
      <div className="flex items-center justify-center gap-8 md:gap-12 mb-10">
        <div className="text-center">
          <div className="w-12 h-12 bg-white border-4 border-black mx-auto mb-3" />
          <p className="font-neo font-extrabold text-black text-sm uppercase tracking-wider">White</p>
          <p className="font-neo text-black opacity-60 text-xs font-bold uppercase">{whiteElo} Elo</p>
        </div>
        <div className="font-neo font-black text-black opacity-20 text-3xl">VS</div>
        <div className="text-center">
          <div className="w-12 h-12 bg-black border-4 border-black mx-auto mb-3" />
          <p className="font-neo font-extrabold text-black text-sm uppercase tracking-wider">Black</p>
          <p className="font-neo text-black opacity-60 text-xs font-bold uppercase">{blackElo} Elo</p>
        </div>
      </div>

      {/* Blunder count */}
      <div className="bg-gray-100 border-4 border-black px-4 py-4 mb-10 text-center">
        <p className="font-neo text-sm md:text-base uppercase tracking-tighter font-bold text-black">
          There are <span className="font-black text-2xl mx-1">{blunderCount}</span> White blunders in this game
        </p>
      </div>

      {/* How to play */}
      <div className="border-t-4 border-black pt-8 mb-8">
        <p className="font-neo font-extrabold text-black text-sm uppercase tracking-widest mb-4 text-center">How to play</p>
        <ul className="font-neo text-sm md:text-base font-medium text-black space-y-3 max-w-md mx-auto list-disc pl-4 marker:text-black">
          <li>Watch the game play out automatically</li>
          <li>You are <strong>only looking for White's blunders</strong></li>
          <li>Press <kbd className="bg-black text-white px-2 py-0.5 border-2 border-black font-mono text-xs font-bold uppercase">Space</kbd> or tap the button when White blunders</li>
          <li>React fast — speed determines your points</li>
          <li>False positives cost you 30 points</li>
        </ul>
      </div>

      <button
        onClick={onStart}
        className="w-full bg-black text-white border-4 border-black px-6 py-5 font-neo font-black text-xl uppercase tracking-tighter hover:bg-white hover:text-black transition-all"
      >
        START GAME
      </button>
    </div>
  );
}
