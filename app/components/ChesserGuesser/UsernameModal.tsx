// Username Input Modal Component
// Shown before starting ranked mode

import { useState, useEffect, useRef } from 'react';

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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

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
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-md border-4 border-black bg-white">
        {/* Header */}
        <div className="border-b-4 border-black bg-white p-4">
          <h2 className="font-neo text-center text-xl font-bold text-black uppercase">Enter Your Username</h2>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="font-neo mb-4 text-center text-sm text-black">
            Your username will appear on the daily leaderboard
          </p>

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={username}
              onChange={handleChange}
              placeholder="Enter username..."
              maxLength={20}
              className="font-neo focus:ring-accent mb-2 w-full border-2 border-black bg-white px-4 py-3 text-black focus:ring-2 focus:outline-none"
              autoComplete="off"
            />

            {error && (
              <div className="font-neo mb-4 border-2 border-red-500 bg-red-100 px-3 py-2 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="font-neo mb-4 text-xs text-gray-600">
              • Less than 20 characters
              <br />• Letters, numbers, and underscores only
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={onCancel}
                className="font-neo border-2 border-black bg-white px-4 py-3 font-bold tracking-wide text-black uppercase transition-colors hover:bg-gray-100"
              >
                {cancelLabel}
              </button>
              <button
                type="submit"
                disabled={!username}
                className="font-neo hover:bg-accent border-2 border-black bg-black px-4 py-3 font-bold tracking-wide text-white uppercase transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
