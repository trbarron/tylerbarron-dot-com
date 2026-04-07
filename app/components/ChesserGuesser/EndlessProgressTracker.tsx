// Endless Progress Tracker Component
// Shows streak and games played for endless mode
// Mirrors the style of DailyProgressTracker

interface EndlessProgressTrackerProps {
    streak: number;
    gamesPlayed: number;
    maxStreak: number;
}

export function EndlessProgressTracker({
    streak,
    gamesPlayed,
    maxStreak
}: EndlessProgressTrackerProps) {
    return (
        <div className="bg-white border-4 border-black">
            {/* Header */}
            <div className="bg-black text-white py-2 px-4 font-neo font-extrabold uppercase tracking-tighter text-sm border-b-4 border-black text-center">
                Endless Mode
            </div>

            {/* Streak Display */}
            <div className="p-4 text-center border-b-4 border-black">
                <div className="font-neo text-4xl font-black text-black tracking-tighter">
                    {streak}
                </div>
                <div className="font-neo text-[10px] uppercase text-black font-extrabold tracking-widest mt-1">
                    Current Streak
                </div>
            </div>

            {/* Max Streak */}
            <div className="p-4 text-center border-b-4 border-black">
                <div className="font-neo text-4xl font-black text-black tracking-tighter">
                    {maxStreak}
                </div>
                <div className="font-neo text-[10px] uppercase text-black font-extrabold tracking-widest mt-1">
                    Best Streak
                </div>
            </div>

            {/* Games Played */}
            <div className="p-4 text-center bg-gray-100">
                <div className="font-neo text-2xl font-black text-black ">
                    {gamesPlayed}
                </div>
                <div className="font-neo text-[10px] uppercase text-black font-extrabold tracking-widest mt-1">
                    Rounds Played
                </div>
            </div>
        </div>
    );
}
