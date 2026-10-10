import { isHandheld } from '~/utils/maiaDrills/device';
import type { AnalysisRun, Stage } from './useAnalysisRun';

const STAGE_LABELS: Record<Stage, string> = {
  idle: '',
  fetching: 'Fetching games…',
  engines: 'Loading Maia and Stockfish…',
  analyzing: 'Analyzing…',
  saving: 'Saving deck…',
};

interface ProgressBarProps {
  value: number;
  max: number;
  label: string;
  /** Shown instead of the count, e.g. while the total isn't known yet. */
  note?: string;
  /** A thinner bar, for the per-game bars under the main one. */
  small?: boolean;
}

function ProgressBar({ value, max, label, note, small }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between font-neo text-xs text-gray-700">
        <span>{label}</span>
        <span className="font-mono">{note ?? `${value.toLocaleString()} / ${max.toLocaleString()}`}</span>
      </div>
      <div className={`${small ? 'h-2' : 'h-3'} border-2 border-black bg-white`}>
        {/* Dynamic width has no Tailwind equivalent. */}
        {/* eslint-disable-next-line react/forbid-dom-props */}
        <div className="h-full bg-black transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Errors and notices from the last run. */
export function RunMessages({ run }: { run: AnalysisRun }) {
  return (
    <>
      {run.error && (
        <div className="border-2 border-red-500 bg-red-100 p-3 font-neo text-sm text-red-800" role="alert">
          {run.error}
        </div>
      )}
      {run.notice && (
        <div className="border-2 border-black bg-gray-50 p-3 font-neo text-sm text-gray-800">{run.notice}</div>
      )}
    </>
  );
}

/** The live panel while a run is going: stage, progress bars, and Cancel. */
export default function RunProgress({ run }: { run: AnalysisRun }) {
  const { stage, gamesFetched, download, progress, backend } = run;
  return (
    <div className="space-y-3 border-2 border-black p-4" aria-live="polite">
      <p className="font-neo text-sm font-bold uppercase tracking-wide">{STAGE_LABELS[stage]}</p>
      {stage === 'fetching' && <p className="font-neo text-sm">{gamesFetched} games so far</p>}
      {download && download.total > 0 && download.received < download.total && (
        <ProgressBar
          label="Maia model (one-time download, MB)"
          value={Math.round(download.received / 1e6)}
          max={Math.round(download.total / 1e6)}
        />
      )}
      {progress && (
        <>
          <ProgressBar label="Games analyzed" value={progress.gamesDone} max={progress.gamesTotal} />
          {progress.current && (
            <div className="space-y-2 border-l-2 border-black pl-3">
              <ProgressBar
                small
                label="This game: Maia"
                value={progress.current.positionsDone}
                max={progress.current.positions}
              />
              <ProgressBar
                small
                label="This game: Stockfish checks"
                value={progress.current.checksDone}
                max={progress.current.checks}
                note={progress.current.maiaDone ? undefined : 'after Maia'}
              />
            </div>
          )}
          <p className="font-neo text-sm">
            <span className="font-bold">{progress.cards}</span> cards found
          </p>
          {backend && (
            <p className="font-neo text-xs text-gray-600">
              {backend === 'webgpu'
                ? 'Maia is running on your GPU.'
                : isHandheld()
                  ? 'Phones run Maia on the CPU, so this will take a while. A computer will be much faster.'
                  : 'Maia is running on your CPU (this browser has no usable WebGPU), so this will take a while.'}
            </p>
          )}
        </>
      )}
      <button
        onClick={run.cancel}
        disabled={stage === 'saving'}
        className="border-2 border-black bg-white px-4 py-2 font-neo text-sm font-bold uppercase tracking-wide hover:bg-black hover:text-white disabled:opacity-50"
      >
        {stage === 'analyzing' ? 'Stop and keep cards so far' : 'Cancel'}
      </button>
    </div>
  );
}
