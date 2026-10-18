# Collaborative Checkmate

2v2 chess: two players per side, and each side's move is chosen together. Every turn both teammates may propose a move. If they agree, it's played; if they disagree, Stockfish plays the stronger of the two. Teammates see that the other has a move in, never which one, until the turn is decided and the log names both.

## Rules

- **Seats.** Opening `/collaborative-checkmate/<code>/<username>` creates the game if the code is new and seats you in the first free seat (White 1, White 2, Black 1, Black 2). A fifth visitor watches. You can switch to a free seat until you ready up.
- **Start.** When all four seats are filled and everyone is ready, White's first turn starts.
- **Turns.** A team has 15 seconds (`SELECTION_MS`). Each player drags a move (it shows as a blue arrow, and can be changed) and may lock it in. The turn ends at the deadline, or as soon as everyone on the team has locked in. An empty seat, or a seated player who never readied, counts as locked in.
- **Choosing.** Both picked the same move: played ("White agreed"). Different moves: the engine evaluates the position after each and plays the better one; a tie goes to the second seat, and an engine failure to the first. One move in: played. None: a random legal move.
- **Leaving.** A seated player whose page hasn't polled for 30 seconds (`SEAT_TIMEOUT_MS`) loses the seat. Rejoining with the same URL takes the first free seat again.
- **End.** Checkmate, stalemate, or a draw by chess.js's rules (insufficient material, threefold repetition, 50 moves). The log reports how many moves each team agreed on. There's no rematch; start a new code.
- **Private games** (lobby checkbox) are never listed in the lobby. Public ones are listed while in setup with a free seat, for 20 minutes.

## How it runs

There is no game server. It's the site's own Lambda, Redis, and polling, the same pattern as Multiple Choice Chess.

```
browser (×4) ── POST /api/collaborativeCheckmate/join     open/create, take a seat
            ── POST /api/collaborativeCheckmate/action    take_seat | ready | not_ready | submit_move | lock_in
            ── GET  /api/collaborativeCheckmate/state     every 500 ms (POLL_MS)
            ── GET  /api/collaborativeCheckmate/available lobby, every 5 s
                         │
                Lambda (React Router resource routes) ── Redis
```

**The polls are the clock.** A turn's deadline is stored, not timed. Every request loads the game and calls `due()`: if all four are ready it starts the game; if a turn's deadline has passed or the team has locked in, that request decides the move. A Redis lock (`collaborativeCheckmate:lock:<id>`, 15 s) makes sure only one request does it; the rest see the `teamN_computing` phase until it's done. If a Lambda dies mid-decision, the game stays in `computing`, and after 20 seconds the next poll redoes it. With four players polling twice a second, a turn ends within about half a second of its deadline. Clients show the countdown from the server's `deadline` and `serverNow`, so device clocks don't matter.

**Stockfish runs on the server** (`app/utils/stockfish.server.ts`): depth 18 or 1 second per position, whichever comes first, so a disagreement takes up to about 2 seconds. The engine isn't shipped in the Lambda; it's downloaded on first use and hash-checked (see `docs/deployment.md`).

**Code:**

| File | What |
|---|---|
| `app/utils/collaborativeCheckmate/rules.ts` | The rules as pure functions on a game record (tested in `tests/utils/collaborativeCheckmateRules.test.ts`) |
| `app/utils/collaborativeCheckmate/game.server.ts` | Redis load/save, transitions, engine, stats |
| `app/utils/collaborativeCheckmate/types.ts` | Shared types and timings |
| `app/hooks/useCollaborativeCheckmate.ts` | Client: join, poll, actions; keeps only the newest response |
| `app/hooks/usePolling.ts` | Polling loop shared with Multiple Choice Chess; never overlaps requests |
| `app/utils/multiplayer/openGames.server.ts` | Lobby list shared with Multiple Choice Chess |

## Redis

| Key | Type | Contents | TTL |
|---|---|---|---|
| `collaborativeCheckmate:game:<id>` | hash | `data` (the game as JSON: seats, moves in UCI, deadline, log) and `version` | 24 h, refreshed on every save |
| `collaborativeCheckmate:seen:<id>` | hash | player → last poll (ms), written at most every 3 s per player | 24 h |
| `collaborativeCheckmate:lock:<id>` | string | held while a move is being decided | 15 s |
| `collaborativeCheckmate:open` | zset | public games in the lobby, by creation time | pruned after 20 min |
| `collaborativeCheckmate:stats` | hash | `games_started`, `games_finished`, `white_wins`, `black_wins`, `draws`, `moves`, `same_moves`, `judged_moves` | none |
| `collaborativeCheckmate:finished` | list | last 200 finished games as JSON: result, moves, agreement counts, players | none |

**Concurrency.** Four players act at once, so every save is a compare-and-set: a small Lua script writes only if `version` hasn't changed since the read, and otherwise the change is re-applied to the fresh game (`update()` in `game.server.ts`). It's done in Lua rather than `WATCH` because the Redis connection is shared by concurrent requests. Presence lives in its own hash so the polls don't contend with game changes, and a player's presence is written before they're seated, so another poll can't see them seated but absent.

**Load.** A poll is one Redis round trip (game and presence in one `MULTI`), plus a presence write every few seconds. That's roughly 2 operations a second per player, about 8–10 for a four-player game. Check the Redis plan's ops/s limit if many games run at once.

**Stats** are read straight from Redis:

```
redis-cli -u "$REDIS_TLS_URL" hgetall collaborativeCheckmate:stats
redis-cli -u "$REDIS_TLS_URL" lrange collaborativeCheckmate:finished 0 9
```

## Testing

- `tests/utils/collaborativeCheckmateRules.test.ts`: the rules, no Redis.
- `tests/api/collaborativeCheckmate.test.ts`: input validation and the API routes, game layer stubbed.
- `tests/utils/stockfishServer.test.ts`: the engine wrapper, including refusing a download whose hash doesn't match.
- `tests/integration/collaborativeCheckmateGame.test.ts`: `game.server.ts` against a **real** Redis, because the compare-and-set is a Lua script the fake Redis can't run. Players act at the same moment: simultaneous joins, readies and lock-ins, a pile of polls after a deadline (one decision, two engine calls), a stuck decision redone, a finished game recorded once, presence written before seating (checked with `MONITOR`). Stockfish is stubbed and the clock faked. It skips itself unless `TEST_REDIS_URL` is set, and refuses any non-local Redis:

  ```
  redis-server --port 6390 --daemonize yes
  TEST_REDIS_URL=redis://localhost:6390 npx vitest run tests/integration/collaborativeCheckmateGame.test.ts
  ```

  Run it after changing `game.server.ts` or `rules.ts`. CI doesn't run it: CI doesn't run `npm test` at all yet.

## History

Until October 2026 the game ran on a separate Python (FastAPI) server on Fly.io (`trbarron/collaborative_checkmate_server`), over WebSockets, with game logs in Supabase. Moving it here removed the second deployment, the Fly cold start on first load, and the Supabase project. It also fixed the lobby's private-game checkbox, which never reached the old server, and the board's arrows, which the shared Chessboard had been overwriting. The old server stored keys as `game:<id>:<field>`; leftovers with that prefix are safe to delete.
