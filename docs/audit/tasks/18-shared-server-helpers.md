# 18 — Shared helpers for the older API routes

|            |              |
| ---------- | ------------ |
| Finding    | A3, P3       |
| Needs      | Repo only    |
| Risk       | Low to medium. Behaviour should not change. |
| Size       | 1 day        |
| Depends on | 11 (it touches the same files; do 11 first) |

## Why

The older endpoints (Chesser Guesser, Blunder Watch, Multiple Choice Chess) each repeat the same plumbing with small differences that have drifted:

- `getTodayDateString()` is defined three times. Blunder Watch's copies use UTC; Chesser Guesser has a time-zone-aware module (`app/utils/chesserGuesser/timezone.server.ts`).
- `validateUsername` is defined twice.
- Request bodies are read with `await request.json()` and cast with `as`, with no size limit. Only the Media Profile route limits body size (`readJsonBody` in `app/routes/api/mediaProfile/share.ts`).
- Every handler has its own method check and `try/catch` returning a JSON 500.
- There are two rate limiters: the shared fixed-window one (`app/utils/rateLimit.server.ts`) and a sliding-window one used only by Chesser Guesser (`app/utils/chesserGuesser/rateLimit.server.ts`), which makes five Redis round trips per check and is not atomic.
- `POST /api/chesserGuesser/submit` makes about thirteen sequential Redis calls.

Collaborative Checkmate (`app/utils/collaborativeCheckmate/validate.ts`) and Media Profile are the patterns to copy. Do not change them.

## The change

1. **`app/utils/http.server.ts`** with:
   - `readJsonBody(request, maxBytes)`: move it from the Media Profile route and use it there too. Returns `{ body }` or `{ error: Response }`.
   - `jsonError(message, status, headers?)`.
   - `methodNotAllowed()`.
   - `isUsername(value: unknown): value is string` (1–20 characters, `[A-Za-z0-9_]`).
   - `isIsoDate(value: unknown): value is string` (`YYYY-MM-DD`).
   - `utcToday()`.

2. **Use them** in the Chesser Guesser, Blunder Watch and Multiple Choice Chess API routes. Give each a body size limit (16 KB is generous for all of them; Blunder Watch's `flags` array is the largest and is bounded by the game length).

3. **Chesser Guesser's limiter.** Replace the sliding-window implementation with calls to the shared `checkRateLimit`. Keep the same three limits (`RATE_LIMITS` in that file: 30/minute for leaderboard reads, 20/minute for puzzle fetches, a 2-second cooldown per username for submissions). The cooldown keys on a username, not an address: add a variant of `checkRateLimit` that takes an explicit key instead of deriving one from the request, rather than faking a request. `tests/api/*.test.ts` and `tests/utils/rateLimit.test.ts` cover the behaviour; the response headers `X-RateLimit-Remaining` and `X-RateLimit-Reset` are part of the public behaviour only if the client reads them. Check `app/routes/chesserGuesser.tsx` and `app/components/ChesserGuesser/`; if nothing reads them, drop them and say so in the PR.

4. **Fewer round trips in `submit`.** After the `SET … NX` that claims the submission, batch the rest with `redis.multi()`: `INCR` and `EXPIRE` the completed counter, `MGET` the four submissions, then a second `multi` for the leaderboard `ZADD`/`EXPIRE` and the summary `SETEX`. Target: four round trips or fewer. Blunder Watch's submit has the same shape on a smaller scale.

## Constraints

- No behaviour change visible to a player. Error messages shown in the UI stay word for word.
- Redis key names do not change. Players have live data under them.
- The daily-game date logic is subtle. `tests/edge-cases/timezone.test.ts` and `tests/integration/dailyMode.test.ts` must pass unmodified. If a test needs changing, stop and explain why before changing it.

## Verify

`npm run lint && npm run typecheck && npm run format:check && npm test`, plus the real-Redis tests: start a local Redis and run `TEST_REDIS_URL=redis://localhost:6379 npm test`. Then play one Chesser Guesser daily puzzle and one Blunder Watch game against `npm run dev` with a local Redis (`REDIS_URL=redis://localhost:6379`).

Commits: `refactor: …` for the shared module, `refactor(chesser-guesser): …`, `refactor(blunder-watch): …`, `refactor(multiple-choice-chess): …`. The round-trip reduction is `perf(chesser-guesser): …`, which releases a patch.

## Done when

The duplicated helpers exist once, every older endpoint limits its body size, and Chesser Guesser's submit makes four Redis round trips or fewer.
