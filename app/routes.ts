import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
  
  // Kebab-case routes (preferred)
  route("bouldering-tracker", "routes/boulderingTracker.tsx"),
  route("camel-up-cup", "routes/camelUpCup.tsx"),
  route("cat-tracker", "routes/catTracker._index.tsx"),
  route("cat-tracker/blog", "routes/catTracker.blog.tsx"),
  route("chesser-guesser/unlimited", "routes/chesserGuesser.unlimited.tsx"),
  route("collaborative-checkmate", "routes/collaborativeCheckmate._index.tsx"),
  route("collaborative-checkmate/:gameId/:playerId", "routes/collaborativeCheckmate.$gameId.$playerId.tsx"),
  route("generative-art", "routes/generativeArt.tsx"),
  route("pizza-rating", "routes/pizzaRating.tsx"),
  route("the-riddler", "routes/theRiddler.tsx"),
  
  // Legacy camelCase and PascalCase routes (for backward compatibility)
  { path: "boulderingTracker", file: "routes/boulderingTracker.tsx", id: "legacy-bouldering-tracker" },
  { path: "BoulderingTracker", file: "routes/boulderingTracker.tsx", id: "legacy-bouldering-tracker-pascal" },
  { path: "camelUpCup", file: "routes/camelUpCup.tsx", id: "legacy-camel-up-cup" },
  { path: "CamelUpCup", file: "routes/camelUpCup.tsx", id: "legacy-camel-up-cup-pascal" },
  { path: "catTracker", file: "routes/catTracker._index.tsx", id: "legacy-cat-tracker" },
  { path: "CatTracker", file: "routes/catTracker._index.tsx", id: "legacy-cat-tracker-pascal" },
  { path: "catTracker/blog", file: "routes/catTracker.blog.tsx", id: "legacy-cat-tracker-blog" },
  { path: "CatTracker/Blog", file: "routes/catTracker.blog.tsx", id: "legacy-cat-tracker-blog-pascal" },
  { path: "chesserGuesser/unlimited", file: "routes/chesserGuesser.unlimited.tsx", id: "legacy-chesser-guesser" },
  { path: "collaborativeCheckmate", file: "routes/collaborativeCheckmate._index.tsx", id: "legacy-collaborative-checkmate" },
  { path: "collaborativeCheckmate/:gameId/:playerId", file: "routes/collaborativeCheckmate.$gameId.$playerId.tsx", id: "legacy-collaborative-checkmate-game" },
  { path: "generativeArt", file: "routes/generativeArt.tsx", id: "legacy-generative-art" },
  { path: "GenerativeArt", file: "routes/generativeArt.tsx", id: "legacy-generative-art-pascal" },
  { path: "pizzaRating", file: "routes/pizzaRating.tsx", id: "legacy-pizza-rating" },
  { path: "PizzaRating", file: "routes/pizzaRating.tsx", id: "legacy-pizza-rating-pascal" },
  { path: "theRiddler", file: "routes/theRiddler.tsx", id: "legacy-the-riddler" },
  { path: "TheRiddler", file: "routes/theRiddler.tsx", id: "legacy-the-riddler-pascal" },
  
  // Other routes
  route("set", "routes/set.tsx"),
  { path: "Set", file: "routes/set.tsx", id: "legacy-set-pascal" },
  route("SSBM", "routes/SSBM.tsx"),
] satisfies RouteConfig;

