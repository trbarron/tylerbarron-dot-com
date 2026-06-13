// Ambient globals injected at runtime by third-party scripts.

/** Google Analytics gtag.js — loaded by the snippet in root.tsx. */
type GtagFn = (command: string, ...args: unknown[]) => void;

interface Window {
  gtag?: GtagFn;
  dataLayer?: unknown[];
}
