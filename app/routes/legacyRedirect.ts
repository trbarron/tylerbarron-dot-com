import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

// Legacy camelCase/PascalCase URLs used to render the same content as their
// kebab-case counterparts, which left duplicate pages competing in search
// results. Permanently redirecting consolidates them onto one canonical URL.
// Keys are lowercase with hyphens stripped, so kebab-case input matches too.
// Renamed projects redirect the same way.
const SEGMENT_MAP: Record<string, string> = {
  b0xx: "SSBM",
  boulderingtracker: "bouldering-tracker",
  camelupcup: "camel-up-cup",
  cattracker: "cat-tracker",
  chesserguesser: "chesser-guesser",
  collaborativecheckmate: "collaborative-checkmate",
  generativeart: "generative-art",
  maiadrills: "maia-marginal-mentor",
  pizzarating: "pizza-rating",
  ssbm: "SSBM",
  theriddler: "the-riddler",
  set: "set",
};

/** Canonical path for a legacy URL, or null if it isn't one we know. Also
 * accepts the static-site `.html` URLs (e.g. /CamelUpCup.html, /B0XX.html)
 * that old inbound links still point at. */
export function legacyRedirectPath(pathname: string, search = ""): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments.length - 1;
  if (last >= 0) segments[last] = segments[last].replace(/\.html$/i, "");
  const [first, ...rest] = segments;
  if (!first || first.toLowerCase() === "index") return "/" + search;
  const target = SEGMENT_MAP[first.toLowerCase().replace(/-/g, "")];
  if (!target) return null;
  // Lowercase known static segments (e.g. CatTracker/Blog) but preserve
  // dynamic ones (game and player IDs are case-sensitive).
  const tail = rest.map((s) => (s.toLowerCase() === "blog" ? "blog" : s));
  return ["", target, ...tail].join("/") + search;
}

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const target = legacyRedirectPath(url.pathname, url.search);
  if (!target) {
    throw new Response("Not Found", { status: 404 });
  }
  return redirect(target, 301);
}
