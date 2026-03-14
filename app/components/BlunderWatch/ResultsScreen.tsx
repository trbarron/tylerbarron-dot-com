// End-of-game results screen shown after all moves have played out and score is submitted.

import { useState } from 'react';
import type { SubmitResponse } from '~/utils/blunderWatch/types';
import { buildShareText } from '~/utils/blunderWatch/resultEmoji';

interface ResultsScreenProps {
  gameNumber: number;
  maxScore: number;
  result: SubmitResponse | null;
  isSubmitting: boolean;
  submitError: string | null;
  onViewLeaderboard: () => void;
}

export function ResultsScreen({
  gameNumber,
  maxScore,
  result,
  isSubmitting,
  submitError,
  onViewLeaderboard,
}: ResultsScreenProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!result) return;
    const text = buildShareText(
      gameNumber,
      result.totalScore,
      maxScore,
      result.blunderResults,
      result.falsePositives,
      result.blundersCaught,
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert(text);
    }
  };

  if (isSubmitting) {
    return (
      <div className="bg-white border-4 border-black p-8 text-center">
        <p className="font-neo font-bold text-black uppercase">Submitting score…</p>
      </div>
    );
  }

  if (submitError) {
    return (
      <div className="bg-red-50 border-4 border-red-500 p-6">
        <p className="font-neo font-bold text-red-700 uppercase mb-2">Submission Error</p>
        <p className="font-neo text-red-600 text-sm">{submitError}</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="bg-white border-4 border-black">
      {/* Header */}
      <div className="bg-black text-white px-6 py-4 text-center">
        <p className="font-neo text-xs uppercase tracking-widest mb-1">Game #{gameNumber} Complete</p>
        <p className="font-neo font-black text-5xl text-white">{result.totalScore}</p>
        <p className="font-neo text-sm text-gray-400">/ {maxScore} points</p>
      </div>

      {/* Emoji result — copy target */}
      <div className="px-6 py-4 text-center border-b-2 border-black">
        <p className="text-2xl tracking-widest mb-3 select-all">{result.resultEmoji}</p>
        <button
          onClick={handleShare}
          className="w-full border-4 border-black px-4 py-3 font-neo font-black uppercase text-base bg-black text-white hover:bg-white hover:text-black transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Results'}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x-2 divide-black border-b-2 border-black">
        <div className="p-4 text-center">
          <p className="font-neo font-black text-2xl text-green-700">{result.blundersCaught}</p>
          <p className="font-neo text-xs uppercase text-gray-500">Caught</p>
        </div>
        <div className="p-4 text-center">
          <p className="font-neo font-black text-2xl text-gray-400">{result.blundersMissed}</p>
          <p className="font-neo text-xs uppercase text-gray-500">Missed</p>
        </div>
        <div className="p-4 text-center">
          <p className={`font-neo font-black text-2xl ${result.falsePositives > 0 ? 'text-red-600' : 'text-black'}`}>
            {result.falsePositives}
          </p>
          <p className="font-neo text-xs uppercase text-gray-500">False pos.</p>
        </div>
      </div>

      {/* Rank */}
      {result.rank !== null && (
        <div className="px-6 py-3 text-center border-b-2 border-black bg-yellow-50">
          <p className="font-neo text-sm text-black">
            You ranked <span className="font-black">#{result.rank}</span> of{' '}
            <span className="font-black">{result.totalPlayers}</span> players today
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="p-4">
        <button
          onClick={onViewLeaderboard}
          className="w-full border-4 border-black px-4 py-3 font-neo font-bold uppercase text-sm bg-white text-black hover:bg-black hover:text-white transition-colors"
        >
          View Leaderboard
        </button>
      </div>
    </div>
  );
}
