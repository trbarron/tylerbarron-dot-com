# Chesser Guesser

Guess Stockfish's evaluation of a real position with a slider (±4 pawns, in hundredths). Lives at `/chesser-guesser`.

## Modes

- **Endless** (default): one random position per page load. A guess counts when it picks the right side: the eval is over +0.2 and you guessed above 0, under −0.2 and you guessed below 0, or within ±0.2 and you guessed within ±0.2. Right answers build a streak; the best streak, games played and the "try the daily" prompt are kept in localStorage (`chesserGuesser:maxStreak`, `:endlessCount`, `:endlessPrompt`).
- **Daily**: the same four positions for everyone, per day. Each guess scores the gap to the eval in centipawns (`|guess − eval|`, `calculatePuzzleScore`), so **lower is better**. After all four, your total goes on the day's leaderboard. One submission per puzzle per user; progress resumes from localStorage (`chesserGuesser:dailyState`). A "day" is in `CHESSER_GUESSER_TIMEZONE`, default UTC (`timezone.server.ts`).

Evals display with two decimals through the shared `formatEval` (`app/utils/chess/evaluation.ts`), because the daily score is in hundredths of a pawn.

## Where positions come from

Not from this site: both modes fetch a random `{ fen, eval }` from a separate API Gateway endpoint, `https://f73vgbj1jk.execute-api.us-west-2.amazonaws.com/prod/chesserGuesser` (its own Lambda, deployed outside this repo). Endless calls it from the route loader on every page load. Daily calls it four times the first time a date is requested, then caches the set in Redis so everyone gets the same four.

**Known issue:** if that endpoint fails three times for a puzzle, the puzzle falls back to the starting position with eval 0, and for daily mode that fallback is cached with the rest of the day's set, so the whole day can be stuck with it. A failed fetch should fail the request instead of caching a placeholder.

`selectDailyPuzzleIndices` / `selectDailyPuzzles` (deterministic picks from a 400-puzzle set) are unused: they date from a plan to fetch the whole set.

## API

| Method | Route | Does |
|---|---|---|
| `GET` | `/api/chesserGuesser/puzzles?date=` | The day's four puzzles (fetched and cached on first request) |
| `POST` | `/api/chesserGuesser/submit` | `{ username, date, puzzleIndex, guess }` → that puzzle's score; on the fourth, adds the total to the leaderboard |
| `GET` | `/api/chesserGuesser/leaderboard?date=&limit=&username=` | Top scores (ascending), plus your rank if `username` is given |

Usernames: 1–20 letters, digits or underscores. Rate limits (`rateLimit.server.ts`, a sliding window in Redis sorted sets): 4 submissions a day and 2 s apart per user; 30 leaderboard and 20 puzzle requests a minute per address.

## Redis

All expire after 7 days.

```
chesserGuesser:dailyPuzzles:{date}                      JSON set of 4 puzzles
chesserGuesser:submission:{date}:{username}:{index}     JSON submission (SET NX: one per puzzle)
chesserGuesser:completed:{date}:{username}              count of puzzles submitted
chesserGuesser:leaderboard:{date}                        ZSET username → total gap, lowest first
chesserGuesser:summary:{date}:{username}                 JSON totals for the leaderboard rows
```

## Tests

`tests/api/puzzles.test.ts`, `submit.test.ts`, `leaderboard.test.ts`, `tests/integration/dailyMode.test.ts`, `tests/utils/puzzleSelection.test.ts`, `seededRandom.test.ts`, `tests/edge-cases/timezone.test.ts`.
