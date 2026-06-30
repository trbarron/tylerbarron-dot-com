/** Fire a GA4 custom event when a route 404s, so broken links are queryable
 * directly — the page title alone is the same ("404 — Barron Wasteland") for
 * every miss, which makes the default pages report useless for finding them. */
export function trackNotFound(path: string): void {
  const { gtag } = window;
  if (typeof gtag !== "function") return;
  gtag("event", "page_not_found", {
    path,
    referrer: document.referrer || "(none)",
  });
}
