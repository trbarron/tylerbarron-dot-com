import { useCallback, useEffect, useRef, useState } from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

/** How long "Copied" shows before the button reads normally again. */
const COPIED_MS = 2000;
/** A failure stays up longer: the user has to act on it (copy by hand). */
const FAILED_MS = 4000;

/**
 * Write `text` to the clipboard. False when the Clipboard API is missing (an
 * insecure context, an old browser) or the write is refused.
 */
export async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copy-to-clipboard with the "Copied" feedback every copy button shows.
 * `copy` resolves true on success, so a caller can fall back (select a field,
 * show the text) when it fails.
 *
 * @example
 * const { state, copy } = useCopy();
 * <Button onClick={() => copy(url)}>{state === 'copied' ? 'Copied' : 'Copy link'}</Button>
 */
export function useCopy() {
  const [state, setState] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async (text: string) => {
    const ok = await writeClipboard(text);
    clearTimeout(timer.current);
    setState(ok ? 'copied' : 'failed');
    timer.current = setTimeout(() => setState('idle'), ok ? COPIED_MS : FAILED_MS);
    return ok;
  }, []);

  return { state, copy };
}
