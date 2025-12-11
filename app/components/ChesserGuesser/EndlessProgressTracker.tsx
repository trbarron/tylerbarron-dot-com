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
        <div className="bg-white  border-4 border-black  mb-4">
            {/* Header */}
            <div className="border-b-2 border-accent py-2 inline-flex items-center justify-center text-sm md:text-md font-neo font-bold uppercase text-black  w-full">
                Endless Mode
            </div>

            {/* Streak Display */}
            <div className="p-4 text-center border-b-2 border-black ">
                <div className="font-neo text-3xl md:text-4xl font-bold text-black ">
                    {streak}
                </div>
                <div className="font-neo text-xs uppercase text-gray-600 ">
                    Current Streak
                </div>
            </div>

            {/* Max Streak */}
            <div className="p-4 text-center border-b-2 border-black">
                <div className="font-neo text-3xl md:text-4xl font-bold text-black ">
                    {maxStreak}
                </div>
                <div className="font-neo text-xs uppercase text-gray-600 ">
                    Best Streak
                </div>
            </div>

            {/* Games Played */}
            <div className="p-4 text-center">
                <div className="font-neo text-xl font-bold text-black ">
                    {gamesPlayed}
                </div>
                <div className="font-neo text-[10px] uppercase text-gray-600 ">
                    Rounds Played
                </div>
            </div>
        </div>
    );
}
