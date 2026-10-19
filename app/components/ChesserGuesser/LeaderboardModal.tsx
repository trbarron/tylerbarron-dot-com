import { Leaderboard } from './Leaderboard';
import Button from '~/components/Button';

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
          aria-label="Close"
          className="hover:text-accent absolute top-1 right-1 z-10 flex h-11 w-11 items-center justify-center text-xl font-bold text-black"
        >
          ✕
        </button>

        <div className="p-6">
          <h2 className="font-neo mb-4 text-center text-2xl font-bold text-black uppercase">Daily Results</h2>

          <Leaderboard currentUsername={username} date={date} />

          <div className="mt-6 flex justify-center">
            <Button variant="primary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
