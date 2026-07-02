import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("blog/:slug", "routes/blog.$slug.tsx"),
  route("favicon.ico", "routes/favicon[.]ico.ts"),
  route("healthcheck", "routes/healthcheck.tsx"),

  // Kebab-case routes (preferred)
  route("blunder-watch", "routes/blunderWatch.tsx"),
  route("bouldering-tracker", "routes/boulderingTracker.tsx"),
  route("camel-up-cup", "routes/camelUpCup._index.tsx"),
  route("camel-up-cup/2018", "routes/camelUpCup.2018.tsx"),
  // The live leaderboard moved up to /camel-up-cup; keep the old sub-path working.
  route("camel-up-cup/leaderboard", "routes/camelUpCup.leaderboardRedirect.ts"),
  route("cat-tracker", "routes/catTracker._index.tsx"),
  route("cat-tracker/blog", "routes/catTracker.blog.tsx"),
  route("chesser-guesser", "routes/chesserGuesser.tsx"),
  route("collaborative-checkmate", "routes/collaborativeCheckmate._index.tsx"),
  route("collaborative-checkmate/:gameId/:playerId", "routes/collaborativeCheckmate.$gameId.$playerId.tsx"),
  route("generative-art", "routes/generativeArt.tsx"),
  route("pizza-rating", "routes/pizzaRating.tsx"),
  route("the-riddler", "routes/theRiddler.tsx"),

  // Legacy camelCase and PascalCase URLs 301-redirect to the kebab-case
  // canonical routes (rendering the same content at both URLs hurt SEO).
  { path: "boulderingTracker", file: "routes/legacyRedirect.ts", id: "legacy-bouldering-tracker" },
  { path: "BoulderingTracker", file: "routes/legacyRedirect.ts", id: "legacy-bouldering-tracker-pascal" },
  { path: "camelUpCup", file: "routes/legacyRedirect.ts", id: "legacy-camel-up-cup" },
  { path: "CamelUpCup", file: "routes/legacyRedirect.ts", id: "legacy-camel-up-cup-pascal" },
  { path: "catTracker", file: "routes/legacyRedirect.ts", id: "legacy-cat-tracker" },
  { path: "CatTracker", file: "routes/legacyRedirect.ts", id: "legacy-cat-tracker-pascal" },
  { path: "catTracker/blog", file: "routes/legacyRedirect.ts", id: "legacy-cat-tracker-blog" },
  { path: "CatTracker/Blog", file: "routes/legacyRedirect.ts", id: "legacy-cat-tracker-blog-pascal" },
  { path: "chesserGuesser", file: "routes/legacyRedirect.ts", id: "legacy-chesser-guesser" },
  { path: "collaborativeCheckmate", file: "routes/legacyRedirect.ts", id: "legacy-collaborative-checkmate" },
  { path: "collaborativeCheckmate/:gameId/:playerId", file: "routes/legacyRedirect.ts", id: "legacy-collaborative-checkmate-game" },
  { path: "generativeArt", file: "routes/legacyRedirect.ts", id: "legacy-generative-art" },
  { path: "GenerativeArt", file: "routes/legacyRedirect.ts", id: "legacy-generative-art-pascal" },
  { path: "pizzaRating", file: "routes/legacyRedirect.ts", id: "legacy-pizza-rating" },
  { path: "PizzaRating", file: "routes/legacyRedirect.ts", id: "legacy-pizza-rating-pascal" },
  { path: "theRiddler", file: "routes/legacyRedirect.ts", id: "legacy-the-riddler" },
  { path: "TheRiddler", file: "routes/legacyRedirect.ts", id: "legacy-the-riddler-pascal" },

  // Other routes. Path matching is case-insensitive, so "set" also serves
  // "/Set" (its canonical link tag points crawlers at /set).
  route("set", "routes/set.tsx"),
  route("SSBM", "routes/SSBM.tsx"),

  // SEO resource routes
  route("robots.txt", "routes/robots[.]txt.ts"),
  route("sitemap.xml", "routes/sitemap[.]xml.ts"),
  route("feed.xml", "routes/feed[.]xml.ts"),
  route("giscus-theme.css", "routes/giscus-theme[.]css.ts"),

  // API routes for Chesser Guesser
  route("api/chesserGuesser/puzzles", "routes/api/chesserGuesser/puzzles.ts"),
  route("api/chesserGuesser/submit", "routes/api/chesserGuesser/submit.ts"),
  route("api/chesserGuesser/leaderboard", "routes/api/chesserGuesser/leaderboard.ts"),

  // API routes for Camel Up Cup bot submissions
  route("api/camelUpCup/submit", "routes/api/camelUpCup/submit.ts"),
  route("api/camelUpCup/status", "routes/api/camelUpCup/status.ts"),

  // API routes for Blunder Watch
  route("api/blunderWatch/game", "routes/api/blunderWatch/game.ts"),
  route("api/blunderWatch/submit", "routes/api/blunderWatch/submit.ts"),
  route("api/blunderWatch/leaderboard", "routes/api/blunderWatch/leaderboard.ts"),

  // Multiple Choice Chess
  route("multiple-choice-chess", "routes/multipleChoiceChess._index.tsx"),
  route("multiple-choice-chess/:gameId/:playerId", "routes/multipleChoiceChess.$gameId.$playerId.tsx"),
  route("api/multipleChoiceChess/create", "routes/api/multipleChoiceChess/create.ts"),
  route("api/multipleChoiceChess/join", "routes/api/multipleChoiceChess/join.ts"),
  route("api/multipleChoiceChess/state", "routes/api/multipleChoiceChess/state.ts"),
  route("api/multipleChoiceChess/move", "routes/api/multipleChoiceChess/move.ts"),
  route("api/multipleChoiceChess/resign", "routes/api/multipleChoiceChess/resign.ts"),
  route("api/multipleChoiceChess/claimWin", "routes/api/multipleChoiceChess/claimWin.ts"),
  route("api/multipleChoiceChess/available", "routes/api/multipleChoiceChess/available.ts"),

  // Catch-all 404 (must stay last) — serves the styled not-found page with a
  // 404 status while keeping the root loader (and analytics) active.
  route("*", "routes/$.tsx"),
] satisfies RouteConfig;

