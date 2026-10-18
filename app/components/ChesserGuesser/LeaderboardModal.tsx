import { Leaderboard } from './Leaderboard';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  date: string;
}

export function LeaderboardModal({ isOpen, onClose, username, date }: LeaderboardModalProps) {
  if (!isOpen) return null;

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md border-4 border-black bg-white shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="hover:text-accent absolute top-2 right-2 z-10 text-xl font-bold text-black"
        >
          ✕
        </button>

        <div className="p-6">
          <h2 className="font-neo mb-4 text-center text-2xl font-bold text-black uppercase">Daily Results</h2>

          <Leaderboard currentUsername={username} date={date} />

          <div className="mt-6 flex justify-center">
            <button
              onClick={onClose}
              className="font-neo hover:bg-accent bg-black px-6 py-2 font-bold text-white uppercase transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
