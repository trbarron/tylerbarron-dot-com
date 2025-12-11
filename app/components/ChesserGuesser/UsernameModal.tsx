// Username Input Modal Component
// Shown before starting ranked mode

import { useState, useEffect, useRef } from "react";

interface UsernameModalProps {
  isOpen: boolean;
  initialUsername?: string;
  onSubmit: (username: string) => void;
  onCancel: () => void;
}

export function UsernameModal({ isOpen, initialUsername = '', onSubmit, onCancel }: UsernameModalProps) {
  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const validateUsername = (name: string): boolean => {
    if (name.length < 3) {
      setError('Username must be at least 3 characters');
      return false;
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white  border-4 border-black  max-w-md w-full">
        {/* Header */}
        <div className="border-b-4 border-black  p-4 bg-white ">
          <h2 className="font-neo font-bold text-xl uppercase text-black  text-center">
            Enter Your Username
          </h2>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="font-neo text-black  mb-4 text-center text-sm">
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
              className="w-full border-2 border-black  bg-white  text-black  px-4 py-3 font-neo focus:outline-none focus:ring-2 focus:ring-accent mb-2"
              autoComplete="off"
            />

            {error && (
              <div className="bg-red-100  border-2 border-red-500  text-red-800  px-3 py-2 mb-4 font-neo text-sm">
                {error}
              </div>
            )}

            <div className="text-xs font-neo text-gray-600  mb-4">
              • 3-20 characters<br />
              • Letters, numbers, and underscores only
            </div>

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={onCancel}
                className="bg-white  text-black  border-2 border-black  px-4 py-3 font-neo font-bold uppercase tracking-wide hover:bg-gray-100  transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={username.length < 3}
                className="bg-black  text-white  border-2 border-black  px-4 py-3 font-neo font-bold uppercase tracking-wide hover:bg-accent  hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Start
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
