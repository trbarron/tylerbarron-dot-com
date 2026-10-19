// Endless Progress Tracker Component
// Shows streak and games played for endless mode
// Mirrors the style of DailyProgressTracker

import Panel from '~/components/Panel';

interface EndlessProgressTrackerProps {
  streak: number;
  gamesPlayed: number;
  maxStreak: number;
}

export function EndlessProgressTracker({ streak, gamesPlayed, maxStreak }: EndlessProgressTrackerProps) {
  return (
    <Panel title="Endless Mode" dark>
      {/* Streak Display */}
      <div className="border-b-4 border-black p-4 text-center">
        <div className="font-neo text-4xl font-black tracking-tighter text-black">{streak}</div>
        <div className="font-neo mt-1 text-[10px] font-extrabold tracking-widest text-black uppercase">
          Current Streak
        </div>
      </div>

      {/* Max Streak */}
      <div className="border-b-4 border-black p-4 text-center">
        <div className="font-neo text-4xl font-black tracking-tighter text-black">{maxStreak}</div>
        <div className="font-neo mt-1 text-[10px] font-extrabold tracking-widest text-black uppercase">Best Streak</div>
      </div>

      {/* Games Played */}
      <div className="bg-gray-100 p-4 text-center">
        <div className="font-neo text-2xl font-black text-black">{gamesPlayed}</div>
        <div className="font-neo mt-1 text-[10px] font-extrabold tracking-widest text-black uppercase">
          Rounds Played
        </div>
      </div>
    </Panel>
  );
}
