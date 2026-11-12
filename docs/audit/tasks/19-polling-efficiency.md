# 19 — Make polling cheaper

|            |              |
| ---------- | ------------ |
| Finding    | P2           |
| Needs      | Repo only    |
| Risk       | Low to medium. Live games depend on polling. |
| Size       | Half a day   |
| Depends on | Nothing      |

## Why

The live games have no socket server: each client polls an API route, and every poll is a Lambda invocation plus at least one Redis read. Collaborative Checkmate polls every 500 ms per player (`POLL_MS` in `app/utils/collaborativeCheckmate/types.ts`); Multiple Choice Chess every 1.2 s on the opponent's turn. Most polls return a state identical to the last one, in full.

## The change

**1. "Nothing changed" responses.** Let the client say what it already has, and answer with almost nothing when that is still current.

- Collaborative Checkmate stores a `version` counter with each game (`CAS_SCRIPT` in `app/utils/collaborativeCheckmate/game.server.ts`). Include it in `publicView`, have the client send `?v=<version>` on the next poll, and return `204 No Content` when the stored version equals it **and** no transition is due.
- Careful: in this game the poll is also the clock. `getGame` calls `advance`, which starts the game, frees abandoned seats and decides moves when a deadline passes. Presence (`touch`) is also written from the poll. The short-circuit must come **after** `touch` and `advance`, never instead of them. Read `docs/collaborative-checkmate.md` before changing this file.
- Countdown timers on the client are derived from deadlines in the state, so a `204` must not freeze them: the hook keeps its last state and keeps ticking locally.
- Multiple Choice Chess already has `last_updated`; the same pattern works (`?since=<last_updated>` → `204`). `touchPlayer` must still run.

**2. Lobby listing.** `openGames.list()` in `app/utils/multiplayer/openGames.server.ts` calls `describe` (a Redis read) once per lobby entry, in sequence, and a `ZREM` per stale entry. Fetch all entries' data in one pipeline and remove stale ones in one `ZREM`. Both games' lobbies use it; keep the function's signature if practical.

**3. Check, don't change:** the Runescape Rascals snapshot endpoint sends `s-maxage=10`. Once task 05 is done, confirm with `curl -sI` that repeated requests are `Hit from cloudfront`, which means all viewers share one Lambda call per ten seconds.

## Tests

- `tests/api/collaborativeCheckmate.test.ts` and `tests/integration/collaborativeCheckmateGame.test.ts` (real Redis). Add: a poll with the current version returns `204`; a poll with the current version **after a deadline has passed** returns `200` with the advanced state; presence is still written on a `204`.
- `tests/api/multipleChoiceChessState.test.ts`: same for `since`.
- Manually: a four-player Collaborative Checkmate game in four tabs through at least three turns, including one where teammates disagree (the engine decides) and one where a player closes their tab (the seat is freed).

## Verify

`npm run lint && npm run typecheck && npm run format:check && TEST_REDIS_URL=redis://localhost:6379 npm test`. Commits: `perf(collaborative-checkmate): …`, `perf(multiple-choice-chess): …`, `perf: …` for the lobby helper.

## Done when

An idle game's polls return `204`, games still advance on time, and a lobby with ten games costs one Redis round trip to list.
