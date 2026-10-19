import { Leaderboard } from './Leaderboard';
import Button from '~/components/Button';
import Dialog from '~/components/Dialog';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  date: string;
}

export function LeaderboardModal({ isOpen, onClose, username, date }: LeaderboardModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog open onClose={onClose} title="Daily Results">
      <div className="p-6">
        <Leaderboard currentUsername={username} date={date} />

        <div className="mt-6 flex justify-center">
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
