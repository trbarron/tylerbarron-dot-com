import { useEffect, useState } from 'react';
import { loadForm, saveForm } from '~/utils/maiaDrills/localStorage';
import { DEFAULT_SETTINGS, LIMITS, type AnalysisSettings, type Deck, type GameSource } from '~/utils/maiaDrills/types';
import { isHandheld } from '~/utils/maiaDrills/device';
import { trackDeckBuilt } from '~/utils/maiaDrills/tracking';
import RunProgress, { RunMessages } from './RunProgress';
import { useAnalysisRun } from './useAnalysisRun';
import Button from '~/components/Button';
import { Checkbox, TextField } from '~/components/Field';

interface BuildFormProps {
  /** Called with a finished (unsaved) deck. */
  onBuilt: (deck: Omit<Deck, 'createdAt'>) => Promise<void>;
}

const SOURCE_LABELS: Record<GameSource, string> = {
  lichess: 'Lichess',
  chesscom: 'Chess.com',
};

function clampInt(value: string, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

type SettingField = 'delta' | 'thresholdWin' | 'alsoGoodWin' | 'depth' | 'skipMoves';
type NumberField = 'maxGames' | SettingField;

function toFields(maxGames: number, settings: AnalysisSettings): Record<NumberField, string> {
  return {
    maxGames: String(maxGames),
    delta: String(settings.delta),
    // Saved settings from before win chance have only thresholdCp; they get the default.
    thresholdWin: String(settings.thresholdWin ?? DEFAULT_SETTINGS.thresholdWin),
    alsoGoodWin: String(settings.alsoGoodWin ?? DEFAULT_SETTINGS.alsoGoodWin),
    depth: String(settings.depth),
    skipMoves: String(settings.skipMoves),
  };
}

function fromFields(fields: Record<NumberField, string>): { maxGames: number; settings: AnalysisSettings } {
  const get = (key: SettingField) =>
    clampInt(fields[key], LIMITS[key].min, LIMITS[key].max, DEFAULT_SETTINGS[key] ?? LIMITS[key].min);
  return {
    maxGames: clampInt(fields.maxGames, LIMITS.games.min, LIMITS.games.max, 200),
    settings: {
      delta: get('delta'),
      thresholdWin: get('thresholdWin'),
      alsoGoodWin: get('alsoGoodWin'),
      depth: get('depth'),
      skipMoves: get('skipMoves'),
    },
  };
}

export default function BuildForm({ onBuilt }: BuildFormProps) {
  const [source, setSource] = useState<GameSource>('lichess');
  const [username, setUsername] = useState('');
  const [excludeBullet, setExcludeBullet] = useState(true);
  // Numbers are edited as text and clamped when a run starts, so typing "150"
  // isn't snapped to the minimum after the first keystroke.
  const [fields, setFields] = useState<Record<NumberField, string>>(toFields(200, DEFAULT_SETTINGS));

  const run = useAnalysisRun();

  useEffect(() => {
    const saved = loadForm();
    if (saved.source) setSource(saved.source);
    if (saved.username) setUsername(saved.username);
    if (typeof saved.excludeBullet === 'boolean') setExcludeBullet(saved.excludeBullet);
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
    const { maxGames, settings } = fromFields(fields);
    setFields(toFields(maxGames, settings));
    saveForm({ source, username: name, maxGames, excludeBullet, settings });

    void run.start({ source, username: name, max: maxGames, excludeBullet, settings }, async (result) => {
      if (result.gamesFetched === 0) throw new Error('No games found to analyze.');
      if (result.cards.length === 0) {
        throw new Error(
          result.cancelled
            ? 'Stopped before any cards were found.'
            : 'No errors found at these settings. Try a larger rating gap or a smaller threshold.',
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
            className={`font-neo flex-1 px-3 py-2 text-sm font-bold tracking-wide uppercase ${
              source === s ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
            }`}
          >
            {SOURCE_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Username"
          id="md-username"
          value={username}
          disabled={busy}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <TextField
          label="Games"
          id="md-games"
          type="number"
          value={fields.maxGames}
          min={LIMITS.games.min}
          max={LIMITS.games.max}
          disabled={busy}
          onChange={setField('maxGames')}
        />
      </div>

      <fieldset className="border-2 border-black p-4">
        <legend className="font-neo px-1 text-xs font-bold tracking-wide uppercase">What counts as an error</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Rating gap (+ points)"
            id="md-delta"
            type="number"
            step={50}
            value={fields.delta}
            disabled={busy}
            onChange={setField('delta')}
          />
          <TextField
            label="Min. win chance lost (%)"
            id="md-threshold"
            type="number"
            step={1}
            value={fields.thresholdWin}
            disabled={busy}
            onChange={setField('thresholdWin')}
          />
        </div>
        <p className="font-neo mt-3 text-sm text-gray-700">
          A move is an error when a player <strong>{fields.delta || 0} points</strong> stronger would have played
          something else, and Stockfish says yours cost at least <strong>{fields.thresholdWin || 0}%</strong> of your
          winning chances.
          {source === 'chesscom' &&
            ' Maia was trained on Lichess ratings, which run higher than Chess.com’s; consider a bigger gap.'}
        </p>

        <details className="mt-3">
          <summary className="font-neo cursor-pointer text-xs font-bold tracking-wide text-gray-600 uppercase hover:text-black">
            More settings
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <TextField
              label="Stockfish depth"
              id="md-depth"
              type="number"
              value={fields.depth}
              disabled={busy}
              onChange={setField('depth')}
            />
            <TextField
              label="“Also good” margin (%)"
              id="md-also-good"
              type="number"
              step={1}
              value={fields.alsoGoodWin}
              disabled={busy}
              onChange={setField('alsoGoodWin')}
            />
            <TextField
              label="Skip moves before move #"
              id="md-skip"
              type="number"
              value={fields.skipMoves}
              disabled={busy}
              onChange={setField('skipMoves')}
            />
            <Checkbox
              label="Skip bullet games"
              className="sm:col-span-2"
              checked={excludeBullet}
              disabled={busy}
              onChange={(e) => setExcludeBullet(e.target.checked)}
            />
          </div>
          <p className="font-neo mt-3 text-sm text-gray-700">
            In a drill, a different move counts as also good when it’s within{' '}
            <strong>{fields.alsoGoodWin || 0}%</strong> win chance of the stronger move.
          </p>
        </details>
      </fieldset>

      <RunMessages run={run} />

      {busy ? (
        <RunProgress run={run} />
      ) : (
        <Button variant="primary" size="lg" className="w-full" onClick={start}>
          Find my errors
        </Button>
      )}
    </div>
  );
}
