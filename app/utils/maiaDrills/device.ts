/**
 * Phones and tablets: a touch screen as the main pointer, or iOS/iPadOS by
 * name (an iPad with a trackpad reports a fine pointer, and iPadOS calls
 * itself a Mac, so its touch screen gives it away).
 *
 * These run Maia on the CPU and get a smaller Stockfish pool. An iPhone's
 * WebGPU attempt failed every time, and the attempt loads the larger GPU
 * runtime and the whole model just before the CPU fallback needs its memory,
 * which got the tab killed. Android was never seen to fail, but has tighter
 * memory than any computer, so it gets the same defensive treatment.
 */
export function isHandheld(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod|Android/.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
}
