// Username Input Modal Component
// Shown before starting ranked mode

import { useState } from 'react';
import Button from '~/components/Button';
import Dialog from '~/components/Dialog';
import { TextField } from '~/components/Field';
import Notice from '~/components/Notice';

interface UsernameModalProps {
  isOpen: boolean;
  initialUsername?: string;
  onSubmit: (username: string) => void;
  onCancel: () => void;
  cancelLabel?: string;
}

export function UsernameModal({
  isOpen,
  initialUsername = '',
  onSubmit,
  onCancel,
  cancelLabel = 'Cancel',
}: UsernameModalProps) {
  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState('');
  const validateUsername = (name: string): boolean => {
    if (name.length > 20) {
      setError('Username must be 20 characters or less');
      return false;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(name)) {
      setError('Username can only contain letters, numbers, and underscores');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateUsername(username)) {
      onSubmit(username);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    if (error) {
      // Clear error on change
      setError('');
    }
  };

  if (!isOpen) return null;

  return (
    // The input is the first focusable element, so opening the dialog focuses it.
    <Dialog open onClose={onCancel} title="Enter Your Username">
      <div className="p-6">
        <p className="font-neo mb-4 text-center text-sm text-black">
          Your username will appear on the daily leaderboard
        </p>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            className="mb-2"
            value={username}
            onChange={handleChange}
            placeholder="Enter username..."
            maxLength={20}
            autoComplete="off"
          />

          {error && <Notice className="mb-4">{error}</Notice>}

          <div className="font-neo mb-4 text-xs text-gray-600">
            • Less than 20 characters
            <br />• Letters, numbers, and underscores only
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button onClick={onCancel}>{cancelLabel}</Button>
            <Button type="submit" variant="primary" disabled={!username}>
              Submit
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
