import { useEffect, useRef, useState } from 'react';
import type { AnalysisProgress } from '~/utils/maiaDrills/analyze';
import type { DownloadProgress, MaiaBackend, MaiaEngine } from '~/utils/maiaDrills/maiaEngine';
import type { StockfishPool } from '~/utils/maiaDrills/stockfishPool';
import { isHandheld } from '~/utils/maiaDrills/device';
import { trackAnalysisCancel, trackAnalysisError, trackAnalysisStart } from '~/utils/maiaDrills/tracking';
import type { AnalysisSettings, DeckStats, DrillCard, GameSource } from '~/utils/maiaDrills/types';

export type Stage = 'idle' | 'fetching' | 'engines' | 'analyzing' | 'saving';

export interface RunRequest {
  source: GameSource;
  username: string;
  max: number;
  excludeBullet: boolean;
  /** Only games played after this, when adding to a deck. */
  since?: number;
  settings: AnalysisSettings;
}

export interface RunResult {
  /** Biggest miss first. */
  cards: DrillCard[];
  stats: DeckStats;
  /** Games fetched, including any skipped for having no rating. */
  gamesFetched: number;
  skippedNoRating: number;
  /** Newest game fetched (ms since epoch), or undefined if none were. */
  newestGameAt?: number;
  cancelled: boolean;
  /** Where Maia ran, if it was loaded. */
  backend?: MaiaBackend;
  /** Since the run started, for analytics. */
  seconds: number;
}

/**
 * Called with the finished analysis, while the run shows "Saving…". Throwing
 * shows the message as an error; returning a string shows it as a notice.
 */
export type SaveResult = (result: RunResult) => Promise<string | void>;

/**
 * One analysis run (fetch games → load Maia and Stockfish → analyze → save),
 * with the progress state the panel shows. Shared by building a deck and
 * adding new games to one.
 */
export function useAnalysisRun() {
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [gamesFetched, setGamesFetched] = useState(0);
  const [download, setDownload] = useState<DownloadProgress | null>(null);
  const [progress, setProgress] = useState<AnalysisProgress | null>(null);
  const [backend, setBackend] = useState<MaiaBackend | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const start = async (request: RunRequest, save: SaveResult) => {
    setError(null);
    setNotice(null);
    setProgress(null);
    setDownload(null);
    setBackend(null);
    setGamesFetched(0);

    const controller = new AbortController();
    abortRef.current = controller;
    let maia: MaiaEngine | null = null;
    let stockfish: StockfishPool | null = null;

    // Plain variables alongside the state, which this closure can't read back.
    const mode = request.since === undefined ? 'build' : 'add';
    const startedAt = Date.now();
    let stageNow: Stage = 'idle';
    let backendNow: MaiaBackend | undefined;
    const enter = (next: Stage) => {
      stageNow = next;
      setStage(next);
    };
    trackAnalysisStart({ mode, source: request.source, gamesRequested: request.max, handheld: isHandheld() });

    try {
      enter('fetching');
      const [maiaModule, poolModule, { analyzeGames }, sources] = await Promise.all([
        import('~/utils/maiaDrills/maiaEngine'),
        import('~/utils/maiaDrills/stockfishPool'),
        import('~/utils/maiaDrills/analyze'),
        import('~/utils/maiaDrills/gameSources'),
      ]);

      const fetcher = request.source === 'lichess' ? sources.fetchLichessGames : sources.fetchChessComGames;
      const fetching = fetcher(request.username, {
        max: request.max,
        excludeBullet: request.excludeBullet,
        since: request.since,
        signal: controller.signal,
        onProgress: setGamesFetched,
      });

      const startMaia = () => {
        const engine = new maiaModule.MaiaEngine({ onProgress: setDownload });
        engine.ready.then((b) => {
          backendNow = b;
          setBackend(b);
        }, () => {});
        return engine;
      };
      // A new deck starts loading Maia while games are fetched. Adding to a deck
      // waits: it often finds no new games, and then there's nothing to load.
      if (request.since === undefined) maia = startMaia();
      const games = await fetching;
      setGamesFetched(games.length);
      const newestGameAt = games.reduce<number | undefined>(
        (newest, g) => (g.playedAt !== undefined && (newest === undefined || g.playedAt > newest) ? g.playedAt : newest),
        undefined
      );
      const empty: RunResult = {
        cards: [],
        stats: { games: 0, positions: 0, disagreements: 0 },
        gamesFetched: games.length,
        skippedNoRating: 0,
        newestGameAt,
        cancelled: false,
        seconds: 0,
      };
      const finished = () => ({ backend: backendNow, seconds: Math.round((Date.now() - startedAt) / 1000) });
      if (games.length === 0) {
        enter('saving');
        const message = await save({ ...empty, ...finished() });
        if (message) setNotice(message);
        return;
      }

      maia ??= startMaia();

      enter('engines');
      // The model download can't be interrupted, but Cancel shouldn't have to wait for it.
      await Promise.race([maia.ready, rejectOnAbort(controller.signal)]);
      // Stockfish starts only once Maia is fully loaded. Started together on an
      // iPhone, Maia was the one refused memory, and Stockfish copes with
      // losing a worker where Maia can't.
      stockfish = poolModule.StockfishPool.forDevice();
      await Promise.race([stockfish.ready(), rejectOnAbort(controller.signal)]);

      enter('analyzing');
      const result = await analyzeGames(games, request.settings, { maia, stockfish }, {
        signal: controller.signal,
        onProgress: setProgress,
      });

      enter('saving');
      // Games are analyzed newest first, so even a stopped run covers the newest game.
      const message = await save({ ...empty, ...result, ...finished() });
      if (message) setNotice(message);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        trackAnalysisCancel({ mode, stage: stageNow });
      } else {
        const message = err instanceof Error ? err.message : 'Something went wrong.';
        setError(message);
        trackAnalysisError({ mode, stage: stageNow, backend: backendNow, error: message });
      }
    } finally {
      maia?.terminate();
      stockfish?.terminate();
      abortRef.current = null;
      setStage('idle');
    }
  };

  return {
    stage,
    busy: stage !== 'idle',
    error,
    notice,
    setError,
    setNotice,
    gamesFetched,
    download,
    progress,
    backend,
    start,
    cancel: () => abortRef.current?.abort(),
  };
}

export type AnalysisRun = ReturnType<typeof useAnalysisRun>;

/** Rejects with an AbortError once `signal` aborts. */
function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const abort = () => reject(new DOMException('Cancelled', 'AbortError'));
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
