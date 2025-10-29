import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
  route("boulderingTracker", "routes/boulderingTracker.tsx"),
  route("camelUpCup", "routes/camelUpCup.tsx"),
  route("catTracker", "routes/catTracker._index.tsx"),
  route("catTracker/blog", "routes/catTracker.blog.tsx"),
  route("chesserGuesser/unlimited", "routes/chesserGuesser.unlimited.tsx"),
  route("collaborativeCheckmate", "routes/collaborativeCheckmate._index.tsx"),
  route("collaborativeCheckmate/:gameId/:playerId", "routes/collaborativeCheckmate.$gameId.$playerId.tsx"),
  route("generativeArt", "routes/generativeArt.tsx"),
  route("pizzaRating", "routes/pizzaRating.tsx"),
  route("set", "routes/set.tsx"),
  route("SSBM", "routes/SSBM.tsx"),
  route("theRiddler", "routes/theRiddler.tsx"),
] satisfies RouteConfig;

