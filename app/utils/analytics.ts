// Client-side GA4 event helpers. All are no-ops during SSR, when GA isn't
// configured, or when an ad blocker kept gtag.js from loading.

type EventParams = Record<string, string | number | boolean | undefined>;

/** Send a GA4 custom event. Use snake_case names (`game_complete`) and keep
 * params flat — GA only reports a param once it's registered as a custom
 * dimension/metric in the property, so prefer reusing existing param names. */
export function trackEvent(name: string, params: EventParams = {}): void {
  if (typeof window === "undefined") return;
  const { gtag } = window;
  if (typeof gtag !== "function") return;
  gtag("event", name, params);
}

/** Fire a GA4 custom event when a route 404s, so broken links are queryable
 * directly — the page title alone is the same ("404 — Barron Wasteland") for
 * every miss, which makes the default pages report useless for finding them. */
export function trackNotFound(path: string): void {
  trackEvent("page_not_found", {
    path,
    referrer: document.referrer || "(none)",
  });
}
