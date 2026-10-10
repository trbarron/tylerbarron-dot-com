import { useEffect, useRef, useState } from 'react';
import type { AnalysisProgress } from '~/utils/maiaDrills/analyze';
import type { DownloadProgress, MaiaBackend, MaiaEngine } from '~/utils/maiaDrills/maiaEngine';
import type { StockfishPool } from '~/utils/maiaDrills/stockfishPool';
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
    let engines: { maia: MaiaEngine; stockfish: StockfishPool } | null = null;

    try {
      setStage('fetching');
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

      const startEngines = () => {
        const maia = new maiaModule.MaiaEngine({ onProgress: setDownload });
        maia.ready.then(setBackend, () => {});
        return { maia, stockfish: poolModule.StockfishPool.forDevice() };
      };
      // A new deck starts the engines while games are fetched. Adding to a deck
      // waits: it often finds no new games, and then there's nothing to load.
      if (request.since === undefined) engines = startEngines();
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
      };
      if (games.length === 0) {
        setStage('saving');
        const message = await save(empty);
        if (message) setNotice(message);
        return;
      }

      engines ??= startEngines();

      setStage('engines');
      // The model download can't be interrupted, but Cancel shouldn't have to wait for it.
      await Promise.race([
        Promise.all([engines.maia.ready, engines.stockfish.ready()]),
        rejectOnAbort(controller.signal),
      ]);

      setStage('analyzing');
      const result = await analyzeGames(games, request.settings, engines, {
        signal: controller.signal,
        onProgress: setProgress,
      });

      setStage('saving');
      // Games are analyzed newest first, so even a stopped run covers the newest game.
      const message = await save({ ...empty, ...result });
      if (message) setNotice(message);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      engines?.maia.terminate();
      engines?.stockfish.terminate();
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
