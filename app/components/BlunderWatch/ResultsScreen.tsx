// End-of-game results screen shown after all moves have played out and score is submitted.

import type { SubmitResponse } from '~/utils/blunderWatch/types';
import { buildShareText } from '~/utils/blunderWatch/resultEmoji';
import Button, { buttonClass } from '~/components/Button';
import { useCopy } from '~/hooks/useCopy';

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
  const { state: copyState, copy } = useCopy();

  const handleShare = async () => {
    if (!result) return;
    const text = buildShareText(
      gameNumber,
      result.totalScore,
      result.blunderResults,
      result.falsePositives,
      result.blundersCaught,
    );
    if (!(await copy(text))) alert(text);
  };

  if (isSubmitting) {
    return (
      <div className="mt-4 border-4 border-black bg-white p-8 text-center">
        <p className="font-neo animate-pulse font-bold tracking-widest text-black uppercase">Submitting score…</p>
      </div>
    );
  }

  if (submitError) {
    return (
      <div className="mt-4 border-4 border-black bg-gray-100 p-6">
        <p className="font-neo mb-2 font-bold tracking-widest text-black uppercase">Submission Error</p>
        <p className="font-neo text-sm font-bold text-black uppercase">{submitError}</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="mt-4 border-4 border-black bg-white">
      {/* Header */}
      <div className="border-b-4 border-black bg-black px-6 py-6 text-center">
        <p className="font-neo mb-1 text-xs tracking-widest text-white uppercase opacity-60">
          Game #{gameNumber} Complete
        </p>
        <p className="font-neo text-4xl leading-none font-black whitespace-nowrap text-white md:text-5xl">
          {result.totalScore} <span className="text-xl text-white opacity-60">pts</span>
        </p>
      </div>

      {/* Emoji result — copy target */}
      <div className="border-b-4 border-black bg-gray-100 px-6 py-6 text-center">
        <p className="mb-4 text-3xl tracking-widest select-all">{result.resultEmoji}</p>
        <Button variant="primary" size="lg" className="w-full" onClick={handleShare}>
          {copyState === 'copied' ? 'COPIED!' : 'COPY RESULTS'}
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 divide-x-4 divide-black border-b-4 border-black">
        <div className="p-4 text-center">
          <p className="font-neo text-3xl font-black tracking-tighter text-black">{result.blundersCaught}</p>
          <p className="font-neo mt-1 text-[10px] font-bold tracking-widest text-black uppercase opacity-60">Caught</p>
        </div>
        <div className="p-4 text-center">
          <p className="font-neo text-3xl font-black tracking-tighter text-black opacity-50">{result.blundersMissed}</p>
          <p className="font-neo mt-1 text-[10px] font-bold tracking-widest text-black uppercase opacity-60">Missed</p>
        </div>
        <div className="p-4 text-center">
          <p
            className={`font-neo text-3xl font-black tracking-tighter ${result.falsePositives > 0 ? 'text-black opacity-50' : 'text-black'}`}
          >
            {result.falsePositives}
          </p>
          <p className="font-neo mt-1 text-[10px] font-bold tracking-widest text-black uppercase opacity-60">
            False pos.
          </p>
        </div>
      </div>

      {/* Rank */}
      {result.rank !== null && (
        <div className="border-b-4 border-black bg-white px-6 py-4 text-center">
          <p className="font-neo text-sm font-bold tracking-wide text-black uppercase">
            You ranked <span className="mx-1 text-lg font-black">#{result.rank}</span> of{' '}
            <span className="mx-1 text-lg font-black">{result.totalPlayers}</span> players today
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-4 p-6">
        {gameUrl && (
          <a href={gameUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ className: 'w-full' })}>
            ANALYZE ON LICHESS
          </a>
        )}
        <Button className="w-full" onClick={onViewLeaderboard}>
          VIEW LEADERBOARD
        </Button>
      </div>
    </div>
  );
}
