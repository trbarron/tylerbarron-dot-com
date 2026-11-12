# 22 — Upgrade ioredis to 6

|            |                                    |
| ---------- | ---------------------------------- |
| Finding    | Dependency update (held back)      |
| Needs      | Repo change; a staging or production Redis to test against |
| Risk       | **Medium to high.** It is the live Redis client for every game. |
| Size       | Half a day                         |
| Depends on | 01, 08 (alarms first, so a regression is noticed) |

## Why

The November 2026 dependency update moved everything to current versions except a few majors. ioredis 6.0.0 was tried and held back: tests passed, but TypeScript reported five errors, all "Argument of type 'number' is not assignable to parameter of type 'string | Buffer'", in:

- `app/routes/api/chesserGuesser/leaderboard.ts` (around line 46)
- `app/utils/chesserGuesser/rateLimit.server.ts` (around lines 61 and 242)
- and two more that `npx tsc` will list.

A type tightening in a major release usually comes with behaviour changes. Most API tests mock Redis, so passing tests say little about the client itself.

## Steps

1. Read the ioredis 6 changelog and migration notes in full (`node_modules/ioredis/Changelog.md` after installing, and the GitHub release). List every breaking change and check each against this repo's usage:

   ```bash
   grep -rn "getRedisClient()\|redis\.\(eval\|multi\|getBuffer\|hset\|hgetall\|zadd\|zrange\|set\)" app | wc -l
   ```

   Pay particular attention to: connection options used in `app/utils/redis.server.ts` (`maxRetriesPerRequest`, `enableReadyCheck`, `retryStrategy`, `connectTimeout`, `commandTimeout`, `tls`), the `status` values that file compares against (`'end'`), `eval` argument handling (three Lua scripts), `getBuffer` (Runescape Rascals images and gzipped sections), and `multi().exec()` result shapes.

2. Install and fix types: `npm install ioredis@^6`. Fix the five errors by passing strings where numbers were passed; do not cast. `server/package.json` lists `ioredis` too: raise its range to `^6` (the installed version comes from the root lockfile; see `scripts/install-lambda-deps.mjs`).

3. Run everything against a real local Redis:

   ```bash
   redis-server --port 6379 --save '' &
   TEST_REDIS_URL=redis://localhost:6379 npm test
   ```

   `tests/integration/` exercises the client for real: `redisClient.test.ts`, `collaborativeCheckmateGame.test.ts`, `multipleChoiceChessGame.test.ts`.

4. Test against the real provider before deploying. The local Redis has no TLS; production does. With the production URL in `.env` (never commit it, never print it):

   ```bash
   node --env-file=.env -e "
     const Redis = require('ioredis');
     const r = new Redis(process.env.REDIS_TLS_URL || process.env.REDIS_URL, { connectTimeout: 5000, commandTimeout: 5000 });
     r.ping().then((x) => { console.log(x); r.disconnect(); }).catch((e) => { console.error(e.message); process.exit(1); });
   "
   ```

   Expect `PONG`. Then `npm run camel:queue` (read-only listing) as a second check.

5. `npm run build:arc && npm run check:lambda-deps`.

## After deploying

Watch for fifteen minutes: `/healthcheck` returns `OK`; create and join a Multiple Choice Chess game; open `/runescape-rascals` and confirm portraits load (they use `getBuffer`); the alarms from task 08 stay quiet.

## Roll back

Revert the commit and deploy. Nothing is migrated in Redis, so rollback is clean.

## Done when

ioredis 6 has run in production for a day with no Redis-related errors in the Lambda's logs. Commit as `fix(deps): …` so it releases.
