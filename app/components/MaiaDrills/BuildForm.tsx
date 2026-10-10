import { useEffect, useState } from 'react';
import { loadForm, saveForm } from '~/utils/maiaDrills/localStorage';
import { DEFAULT_SETTINGS, LIMITS, LOST_CP, type AnalysisSettings, type Deck, type GameSource } from '~/utils/maiaDrills/types';
import { isHandheld } from '~/utils/maiaDrills/device';
import { trackDeckBuilt } from '~/utils/maiaDrills/tracking';
import RunProgress, { RunMessages } from './RunProgress';
import { useAnalysisRun } from './useAnalysisRun';

interface BuildFormProps {
  /** Called with a finished (unsaved) deck. */
  onBuilt: (deck: Omit<Deck, 'createdAt'>) => Promise<void>;
}

const SOURCE_LABELS: Record<GameSource, string> = {
  lichess: 'Lichess',
  chesscom: 'Chess.com',
};

const inputClass =
  'w-full border-2 border-black bg-white px-3 py-2 font-neo text-black focus:outline-none focus:ring-2 focus:ring-black';
const labelClass = 'mb-1 block font-neo text-xs font-bold uppercase tracking-wide text-black';

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

type SettingField = 'delta' | 'thresholdCp' | 'depth' | 'skipMoves';
type NumberField = 'maxGames' | SettingField;

function toFields(maxGames: number, settings: AnalysisSettings): Record<NumberField, string> {
  return {
    maxGames: String(maxGames),
    delta: String(settings.delta),
    thresholdCp: String(settings.thresholdCp),
    depth: String(settings.depth),
    skipMoves: String(settings.skipMoves),
  };
}

function fromFields(
  fields: Record<NumberField, string>,
  skipLost: boolean
): { maxGames: number; settings: AnalysisSettings } {
  const get = (key: SettingField) =>
    clampInt(fields[key], LIMITS[key].min, LIMITS[key].max, DEFAULT_SETTINGS[key]);
  return {
    maxGames: clampInt(fields.maxGames, LIMITS.games.min, LIMITS.games.max, 200),
    settings: {
      delta: get('delta'),
      thresholdCp: get('thresholdCp'),
      depth: get('depth'),
      skipMoves: get('skipMoves'),
      skipLost,
    },
  };
}

export default function BuildForm({ onBuilt }: BuildFormProps) {
  const [source, setSource] = useState<GameSource>('lichess');
  const [username, setUsername] = useState('');
  const [excludeBullet, setExcludeBullet] = useState(true);
  const [skipLost, setSkipLost] = useState(DEFAULT_SETTINGS.skipLost ?? true);
  // Numbers are edited as text and clamped when a run starts, so typing "150"
  // isn't snapped to the minimum after the first keystroke.
  const [fields, setFields] = useState<Record<NumberField, string>>(toFields(200, DEFAULT_SETTINGS));

  const run = useAnalysisRun();

  useEffect(() => {
    const saved = loadForm();
    if (saved.source) setSource(saved.source);
    if (saved.username) setUsername(saved.username);
    if (typeof saved.excludeBullet === 'boolean') setExcludeBullet(saved.excludeBullet);
    if (typeof saved.settings?.skipLost === 'boolean') setSkipLost(saved.settings.skipLost);
    // A phone runs everything on the CPU, so a first run there starts smaller.
    setFields(toFields(saved.maxGames ?? (isHandheld() ? 50 : 200), { ...DEFAULT_SETTINGS, ...saved.settings }));
  }, []);

  const setField = (key: NumberField) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setFields((f) => ({ ...f, [key]: e.target.value }));

  const busy = run.busy;

  const start = () => {
    const name = username.trim();
    if (!name) {
      run.setError('Enter a username.');
      return;
    }
    const { maxGames, settings } = fromFields(fields, skipLost);
    setFields(toFields(maxGames, settings));
    saveForm({ source, username: name, maxGames, excludeBullet, settings });

    void run.start({ source, username: name, max: maxGames, excludeBullet, settings }, async (result) => {
      if (result.gamesFetched === 0) throw new Error('No games found to analyze.');
      if (result.cards.length === 0) {
        throw new Error(
          result.cancelled
            ? 'Stopped before any cards were found.'
            : 'No errors found at these settings. Try a larger rating gap or a smaller threshold.'
        );
      }
      const cards = result.cards.slice(0, LIMITS.cardsPerDeck);
      await onBuilt({
        v: 1,
        source,
        username: name,
        settings,
        excludeBullet,
        newestGameAt: result.newestGameAt,
        stats: result.stats,
        // Biggest misses first; the server caps deck size.
        cards,
      });
      trackDeckBuilt({
        source,
        games: result.gamesFetched,
        cards: cards.length,
        backend: result.backend,
        seconds: result.seconds,
        stopped: result.cancelled,
      });
      if (result.skippedNoRating) return `${result.skippedNoRating} game(s) had no rating for you and were skipped.`;
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex border-2 border-black" role="tablist" aria-label="Game source">
        {(Object.keys(SOURCE_LABELS) as GameSource[]).map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={source === s}
            disabled={busy}
            onClick={() => setSource(s)}
            className={`flex-1 px-3 py-2 font-neo text-sm font-bold uppercase tracking-wide ${
              source === s ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            {SOURCE_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="md-username" className={labelClass}>
            Username
          </label>
          <input
            id="md-username"
            className={inputClass}
            value={username}
            disabled={busy}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div>
          <label htmlFor="md-games" className={labelClass}>
            Games
          </label>
          <input
            id="md-games"
            type="number"
            className={inputClass}
            value={fields.maxGames}
            min={LIMITS.games.min}
            max={LIMITS.games.max}
            disabled={busy}
            onChange={setField('maxGames')}
          />
        </div>
      </div>

      <fieldset className="border-2 border-black p-4">
        <legend className="px-1 font-neo text-xs font-bold uppercase tracking-wide">What counts as an error</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="md-delta" className={labelClass}>
              Rating gap (+ points)
            </label>
            <input
              id="md-delta"
              type="number"
              step={50}
              className={inputClass}
              value={fields.delta}
              disabled={busy}
              onChange={setField('delta')}
            />
          </div>
          <div>
            <label htmlFor="md-threshold" className={labelClass}>
              Min. difference (centipawns)
            </label>
            <input
              id="md-threshold"
              type="number"
              step={25}
              className={inputClass}
              value={fields.thresholdCp}
              disabled={busy}
              onChange={setField('thresholdCp')}
            />
          </div>
        </div>
        <p className="mt-3 font-neo text-sm text-gray-700">
          A move is an error when a player <strong>{fields.delta || 0} points</strong> stronger would have played
          something else, and Stockfish rates their move at least <strong>{fields.thresholdCp || 0} cp</strong> better.
          {source === 'chesscom' && ' Maia was trained on Lichess ratings, which run higher than Chess.com’s; consider a bigger gap.'}
        </p>

        <details className="mt-3">
          <summary className="cursor-pointer font-neo text-xs font-bold uppercase tracking-wide text-gray-600 hover:text-black">
            More settings
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="md-depth" className={labelClass}>
                Stockfish depth
              </label>
              <input
                id="md-depth"
                type="number"
                className={inputClass}
                value={fields.depth}
                disabled={busy}
                onChange={setField('depth')}
              />
            </div>
            <div>
              <label htmlFor="md-skip" className={labelClass}>
                Skip moves before move #
              </label>
              <input
                id="md-skip"
                type="number"
                className={inputClass}
                value={fields.skipMoves}
                disabled={busy}
                onChange={setField('skipMoves')}
              />
            </div>
            <label className="flex items-center gap-2 font-neo text-sm text-black sm:col-span-2">
              <input
                type="checkbox"
                checked={excludeBullet}
                disabled={busy}
                onChange={(e) => setExcludeBullet(e.target.checked)}
                className="h-4 w-4 accent-black"
              />
              Skip bullet games
            </label>
            <label className="flex items-center gap-2 font-neo text-sm text-black sm:col-span-2">
              <input
                type="checkbox"
                checked={skipLost}
                disabled={busy}
                onChange={(e) => setSkipLost(e.target.checked)}
                className="h-4 w-4 shrink-0 accent-black"
              />
              Skip positions you’d already lost (down {LOST_CP / 100} or more before and after your move)
            </label>
          </div>
        </details>
      </fieldset>

      <RunMessages run={run} />

      {busy ? (
        <RunProgress run={run} />
      ) : (
        <button
          onClick={start}
          className="w-full border-4 border-black bg-black px-6 py-4 font-neo text-lg font-extrabold uppercase tracking-wide text-white hover:bg-white hover:text-black"
        >
          Find my errors
        </button>
      )}
    </div>
  );
}
