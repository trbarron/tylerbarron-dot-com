# 11 — Rate-limit the remaining endpoints that write to Redis

|            |                                             |
| ---------- | ------------------------------------------- |
| Finding    | S4                                          |
| Needs      | Repo only (one optional check needs Redis access) |
| Risk       | Low                                         |
| Size       | 2 to 3 hours                                |
| Depends on | Nothing. More effective once 06 is done.    |

## Why

These endpoints create Redis keys for anyone, with no per-address limit. A loop with random usernames or game codes fills Redis or pushes real entries off a leaderboard.

| Endpoint | File | What one request creates | TTL |
| --- | --- | --- | --- |
| `POST /api/collaborativeCheckmate/join` | `app/routes/api/collaborativeCheckmate/join.ts` | A game per new code, plus presence | 24 h |
| `POST /api/blunderWatch/submit` | `app/routes/api/blunderWatch/submit.ts` | 2 keys and a leaderboard member per new username | 7 days |
| `POST /api/chesserGuesser/submit` | `app/routes/api/chesserGuesser/submit.ts` | Up to 3 keys per new username. Its existing cooldown is per username, so a new name each time bypasses it. | 7 days |

`POST /api/multipleChoiceChess/create` was limited in PR #128 and is the pattern to copy.

## The change

Use the shared limiter, `checkRateLimit(request, scope, bucket, limit)` from `app/utils/rateLimit.server.ts`. It returns `{ allowed, retryAfter }` and fails open if Redis is down. See `app/routes/api/multipleChoiceChess/create.ts` for the exact shape, including the `429` response with a `Retry-After` header.

Suggested limits (per address):

| Endpoint | Limit | Reasoning |
| --- | --- | --- |
| Collaborative Checkmate `join` | 60 per hour | Joining an existing game also goes through here, and four friends may share one address. |
| Blunder Watch `submit` | 10 per hour | One submission a day per username is the real use. |
| Chesser Guesser `submit` | 40 per hour | Four puzzles a day per username; allow a household. |

Rules:

- Call the limiter **after** input validation and **before** the first Redis write, so malformed requests cost nothing and do not count.
- Keep the existing per-username cooldown in Chesser Guesser; this is in addition.
- Scope names are the Redis key prefix: use `collaborativeCheckmate`, `blunderWatch`, `chesserGuesser`.

Two small fixes in the same files, both from the audit:

- `date` in both submit endpoints is client-supplied and only format-checked. Reject a date that is not today or yesterday (UTC), so old leaderboards cannot be rewritten. Yesterday must stay allowed: a player in a late time zone finishes "today's" puzzle after UTC midnight. Check how each game defines its day before choosing the rule (`app/utils/chesserGuesser/timezone.server.ts` exists for a reason).
- The `completed` counter in Chesser Guesser's submit is `GET` then `SETEX`. Replace with `INCR` and `EXPIRE`.

## Tests

Existing tests mock Redis per file (`tests/api/submit.test.ts`, `tests/api/leaderboard.test.ts`, `tests/api/collaborativeCheckmate.test.ts`). The limiter calls `incr` and `expire` on the mock; add those to each mock if missing. Add one test per endpoint: the request after the limit returns `429` and writes nothing.

## Optional check (needs Redis access)

```bash
redis-cli -u "$REDIS_TLS_URL" config get maxmemory-policy
redis-cli -u "$REDIS_TLS_URL" info memory | grep -E 'used_memory_human|maxmemory_human'
```

An evicting policy (`volatile-ttl` suits this data) means a fill degrades instead of failing every write. Some managed providers do not allow `CONFIG`; if so, check the provider's dashboard. Report the value; changing it is the owner's call.

## Verify

`npm run lint && npm run typecheck && npm run format:check && npm test`. Three commits, one per game, each `fix(<scope>): …` with scopes `collaborative-checkmate`, `blunder-watch`, `chesser-guesser`.

## Done when

All three endpoints return `429` past their limit, with tests, and the status table is updated.
