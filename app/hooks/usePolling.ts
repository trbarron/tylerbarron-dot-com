import { useEffect, useRef } from 'react';

interface PollingOptions {
  /** Keep polling while the tab is hidden (a game seat that should stay held). Default: pause, and poll again on return. */
  whileHidden?: boolean;
}

/**
 * Call `poll` now and then every `intervalMs` (null stops). Each call finishes
 * before the next is scheduled, so a slow response never stacks requests.
 * Errors are the caller's to handle; a throw just waits for the next tick.
 */
export function usePolling(
  poll: () => unknown,
  intervalMs: number | null,
  { whileHidden = false }: PollingOptions = {},
) {
  const pollRef = useRef(poll);
  useEffect(() => {
    pollRef.current = poll;
  });

  useEffect(() => {
    if (intervalMs === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let running = false;
    let stopped = false;

    const tick = async () => {
      if (stopped || running) return;
      clearTimeout(timer);
      if (!whileHidden && document.hidden) return;
      running = true;
      try {
        await pollRef.current();
      } catch {
        // Next tick tries again.
      } finally {
        running = false;
      }
      if (!stopped) timer = setTimeout(tick, intervalMs);
    };

    const onVisibility = () => {
      if (!document.hidden) void tick();
    };

    void tick();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, whileHidden]);
}
