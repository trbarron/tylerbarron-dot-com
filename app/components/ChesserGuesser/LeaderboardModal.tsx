import { Leaderboard } from "./Leaderboard";

interface LeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    username: string;
    date: string;
}

export function LeaderboardModal({
    isOpen,
    onClose,
    username,
    date
}: LeaderboardModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white dark:bg-black border-4 border-black dark:!border-white w-full max-w-md shadow-2xl relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 text-black dark:text-white hover:text-accent font-bold text-xl z-10"
                >
                    ✕
                </button>

                <div className="p-6">
                    <h2 className="text-2xl font-neo font-bold text-center mb-4 text-black dark:text-white uppercase">
                        Daily Results
                    </h2>

                    <Leaderboard
                        currentUsername={username}
                        date={date}
                    />

                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={onClose}
                            className="bg-black dark:bg-white text-white dark:text-black px-6 py-2 font-neo font-bold uppercase hover:bg-accent dark:hover:bg-accent transition-colors"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
