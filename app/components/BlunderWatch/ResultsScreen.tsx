// End-of-game results screen shown after all moves have played out and score is submitted.

import { useState } from 'react';
import type { SubmitResponse } from '~/utils/blunderWatch/types';
import { buildShareText } from '~/utils/blunderWatch/resultEmoji';

interface ResultsScreenProps {
  gameNumber: number;
  gameUrl?: string;
  result: SubmitResponse | null;
  isSubmitting: boolean;
  submitError: string | null;
  onViewLeaderboard: () => void;
}

export function ResultsScreen({
  gameNumber,
  gameUrl,
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
      <div className="bg-white border-4 border-black p-8 text-center mt-4">
        <p className="font-neo font-bold text-black uppercase tracking-widest animate-pulse">Submitting score…</p>
      </div>
    );
  }

  if (submitError) {
    return (
      <div className="bg-gray-100 border-4 border-black p-6 mt-4">
        <p className="font-neo font-bold text-black uppercase mb-2 tracking-widest">Submission Error</p>
        <p className="font-neo text-black font-bold text-sm uppercase">{submitError}</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="bg-white border-4 border-black mt-4">
      {/* Header */}
      <div className="bg-black px-6 py-6 text-center border-b-4 border-black">
        <p className="font-neo text-xs uppercase tracking-widest mb-1 text-white opacity-60">Game #{gameNumber} Complete</p>
        <p className="font-neo font-black text-4xl md:text-5xl text-white leading-none whitespace-nowrap">{result.totalScore} <span className="text-xl text-white opacity-60">pts</span></p>
      </div>

      {/* Emoji result — copy target */}
      <div className="px-6 py-6 text-center border-b-4 border-black bg-gray-100">
        <p className="text-3xl tracking-widest mb-4 select-all">{result.resultEmoji}</p>
        <button
          onClick={handleShare}
          className="w-full border-4 border-black px-4 py-4 font-neo font-black uppercase text-lg bg-black text-white hover:bg-white hover:text-black transition-all duration-100"
        >
          {copied ? 'COPIED!' : 'COPY RESULTS'}
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x-4 divide-black border-b-4 border-black">
        <div className="p-4 text-center">
          <p className="font-neo font-black text-3xl tracking-tighter text-black">{result.blundersCaught}</p>
          <p className="font-neo text-[10px] uppercase font-bold tracking-widest text-black opacity-60 mt-1">Caught</p>
        </div>
        <div className="p-4 text-center">
          <p className="font-neo font-black text-3xl tracking-tighter text-black opacity-50">{result.blundersMissed}</p>
          <p className="font-neo text-[10px] uppercase font-bold tracking-widest text-black opacity-60 mt-1">Missed</p>
        </div>
        <div className="p-4 text-center">
          <p className={`font-neo font-black text-3xl tracking-tighter ${result.falsePositives > 0 ? 'text-black opacity-50' : 'text-black'}`}>
            {result.falsePositives}
          </p>
          <p className="font-neo text-[10px] uppercase font-bold tracking-widest text-black opacity-60 mt-1">False pos.</p>
        </div>
      </div>

      {/* Rank */}
      {result.rank !== null && (
        <div className="px-6 py-4 text-center border-b-4 border-black bg-white">
          <p className="font-neo text-sm font-bold uppercase tracking-wide text-black">
            You ranked <span className="font-black text-lg mx-1">#{result.rank}</span> of{' '}
            <span className="font-black text-lg mx-1">{result.totalPlayers}</span> players today
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="p-6 flex flex-col gap-4">
        {gameUrl && (
          <a
            href={gameUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border-4 border-black px-4 py-4 font-neo font-black uppercase text-sm bg-white text-black hover:bg-black hover:text-white transition-all duration-100 text-center"
          >
            ANALYZE ON LICHESS
          </a>
        )}
        <button
          onClick={onViewLeaderboard}
          className="w-full border-4 border-black px-4 py-4 font-neo font-black uppercase text-sm bg-white text-black hover:bg-black hover:text-white transition-all duration-100"
        >
          VIEW LEADERBOARD
        </button>
      </div>
    </div>
  );
}
