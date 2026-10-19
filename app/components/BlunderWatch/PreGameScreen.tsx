// Pre-game screen shown before playback begins

import Button from '~/components/Button';

interface PreGameScreenProps {
  whiteElo: number;
  blackElo: number;
  blunderCount: number;
  onStart: () => void;
}

export function PreGameScreen({ whiteElo, blackElo, blunderCount, onStart }: PreGameScreenProps) {
  return (
    <div className="mb-4 w-full border-4 border-black bg-white p-8">
      {/* Matchup */}
      <div className="mb-10 flex items-center justify-center gap-8 md:gap-12">
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 border-4 border-black bg-white" />
          <p className="font-neo text-sm font-extrabold tracking-wider text-black uppercase">White</p>
          <p className="font-neo text-xs font-bold text-black uppercase opacity-60">{whiteElo} Elo</p>
        </div>
        <div className="font-neo text-3xl font-black text-black opacity-20">VS</div>
        <div className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 border-4 border-black bg-black" />
          <p className="font-neo text-sm font-extrabold tracking-wider text-black uppercase">Black</p>
          <p className="font-neo text-xs font-bold text-black uppercase opacity-60">{blackElo} Elo</p>
        </div>
      </div>

      {/* Blunder count */}
      <div className="mb-10 border-4 border-black bg-gray-100 px-4 py-4 text-center">
        <p className="font-neo text-sm font-bold tracking-tighter text-black uppercase md:text-base">
          There are <span className="mx-1 text-2xl font-black">{blunderCount}</span> White blunders in this game
        </p>
      </div>

      {/* How to play */}
      <div className="mb-8 border-t-4 border-black pt-8">
        <p className="font-neo mb-4 text-center text-sm font-extrabold tracking-widest text-black uppercase">
          How to play
        </p>
        <ul className="font-neo mx-auto max-w-md list-disc space-y-3 pl-4 text-sm font-medium text-black marker:text-black md:text-base">
          <li>Watch the game play out automatically</li>
          <li>
            You are <strong>only looking for White's blunders</strong>
          </li>
          <li>
            Press{' '}
            <kbd className="border-2 border-black bg-black px-2 py-0.5 font-mono text-xs font-bold text-white uppercase">
              Space
            </kbd>{' '}
            or tap the button when White blunders
          </li>
          <li>React fast — speed determines your points</li>
          <li>False positives cost you 30 points</li>
        </ul>
      </div>

      <Button variant="primary" size="lg" className="w-full" onClick={onStart}>
        START GAME
      </Button>
    </div>
  );
}
