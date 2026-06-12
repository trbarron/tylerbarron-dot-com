import { redirect } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

// Legacy camelCase/PascalCase URLs used to render the same content as their
// kebab-case counterparts, which left duplicate pages competing in search
// results. Permanently redirecting consolidates them onto one canonical URL.
const SEGMENT_MAP: Record<string, string> = {
  boulderingtracker: "bouldering-tracker",
  camelupcup: "camel-up-cup",
  cattracker: "cat-tracker",
  chesserguesser: "chesser-guesser",
  collaborativecheckmate: "collaborative-checkmate",
  generativeart: "generative-art",
  pizzarating: "pizza-rating",
  theriddler: "the-riddler",
  set: "set",
};

export function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const [first, ...rest] = url.pathname.split("/").filter(Boolean);
  const target = first && SEGMENT_MAP[first.toLowerCase()];
  if (!target) {
    throw new Response("Not Found", { status: 404 });
  }
  // Lowercase known static segments (e.g. CatTracker/Blog) but preserve
  // dynamic ones (game and player IDs are case-sensitive).
  const tail = rest.map((s) => (s.toLowerCase() === "blog" ? "blog" : s));
  return redirect(["", target, ...tail].join("/") + url.search, 301);
}
