// Daily Completion Message Component
// Shown when user completes all 4 daily puzzles

interface DailyCompletionMessageProps {
  totalScore: number;
  rank?: number;
  totalPlayers?: number;
}

export function DailyCompletionMessage({
  totalScore,
  rank,
  totalPlayers
}: DailyCompletionMessageProps) {
  const getRankMessage = () => {
    if (!rank) return '';
    if (rank === 1) return "🥇 You're in 1st place!";
    if (rank === 2) return "🥈 You're in 2nd place!";
    if (rank === 3) return "🥉 You're in 3rd place!";
    if (rank <= 10) return `🏆 You're in the top 10!`;
    if (totalPlayers && rank <= totalPlayers / 4) return `📈 You're in the top 25%!`;
    return `✅ Great job!`;
  };

  const getScoreMessage = () => {
    if (totalScore >= 350) return "Outstanding! 🌟";
    if (totalScore >= 300) return "Excellent work! 💯";
    if (totalScore >= 250) return "Great job! 👏";
    if (totalScore >= 200) return "Well done! 👍";
    if (totalScore >= 150) return "Good effort! 💪";
    return "Thanks for playing! 🎯";
  };

  return (
    <div className="bg-accent border-4 border-black dark:!border-white p-6 mb-4">
      <div className="text-center">
        <h2 className="font-neo font-bold uppercase text-2xl text-white mb-4">
          Daily Complete!
        </h2>

        <div className="bg-white dark:bg-black border-2 border-black dark:!border-white p-4 mb-4">
          <div className="font-neo text-4xl font-bold text-black dark:text-white">
            {totalScore}
          </div>
          <div className="font-neo text-sm text-gray-600 dark:text-gray-400 uppercase">
            Total Points
          </div>
        </div>

        <div className="space-y-2 text-white font-neo">
          <p className="text-lg font-bold">{getScoreMessage()}</p>
          {rank && (
            <p className="text-md">{getRankMessage()}</p>
          )}
          {totalPlayers && rank && (
            <p className="text-sm">
              Rank: #{rank} out of {totalPlayers} players
            </p>
          )}
        </div>

        <div className="mt-4 pt-4 border-t-2 border-white">
          <p className="font-neo text-sm text-white">
            Come back tomorrow for new puzzles!
          </p>
        </div>
      </div>
    </div>
  );
}
