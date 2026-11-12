# 27 — A local tournament runner for Camel Up Cup

|            |                                                    |
| ---------- | -------------------------------------------------- |
| Finding    | S7 (replacement flow)                              |
| Needs      | The `trbarron/Camel_Up_Cup_2K18` repository; Docker; AWS credentials to publish |
| Risk       | **This runs strangers' Python on the owner's machine.** The isolation is the task. |
| Size       | 1 day                                              |
| Depends on | 02                                                 |

## Why

The site now queues submitted bots and emails the owner instead of running them (`app/utils/camelUpCup/tournament.server.ts`). The other half does not exist yet: something the owner runs locally that takes the waiting bots, plays a tournament with enough games for the standings to mean something, and publishes the result where the site reads it.

The audit session could not see the `Camel_Up_Cup_2K18` repository. Everything below about it is an assumption to verify.

## What this repo provides

- `npm run camel:queue` lists waiting bots (reads the Redis hash `camelup:pending`).
- `npm run camel:queue -- pull ./camel-bots` writes each to `./camel-bots/<BotName>.py`.
- `npm run camel:queue -- done <id> [...]` removes them once they have played.
- The site's page (`app/routes/camelUpCup._index.tsx`) reads `images/camel-up/leaderboard.json` from the asset bucket. Its shape is `Leaderboard` in `app/utils/camelUpCup/types.ts`: `updated`, `totalGames`, optional `lastSubmission`, and `bots[]` with `name`, `author`, `builtin`, `submitted`, `elo`, `wins`, `games`, `winPct`, `avgCoins`, `avgMoveMs`, `maxMoveMs`, `actions`. The runner must keep producing exactly this.

## What to build, in the other repository

1. **Read first.** Find the existing Lambda handler (`lambda/handler.py`), the sandbox (`lambda/sandbox.py`), how it loads house bots, how it computes Elo and how it writes `leaderboard.json`. Reuse that logic; do not reimplement scoring.

2. **A command-line entry point**, for example `python run_tournament.py --bots ./camel-bots --games 5000 --out leaderboard.json`, that:
   - loads the house bots plus every `.py` in the folder,
   - validates each submitted bot with the existing AST checks and reports rejections with reasons,
   - plays the games (the old Lambda ran about 500, which the owner found too few),
   - enforces the per-move time limit (5 seconds; the page tells entrants this),
   - writes `leaderboard.json` in the existing shape, merging with the previous board so earlier entrants stay on it.

3. **Isolation. Not optional.** The AST allow-list is a courtesy, not a boundary; Python sandboxes built that way have a long history of escapes. Run the whole tournament inside a container that cannot hurt the host:

   ```bash
   docker run --rm --network none --read-only --tmpfs /tmp \
     --cpus 4 --memory 4g --pids-limit 256 --cap-drop ALL --security-opt no-new-privileges \
     --user 65534:65534 \
     -v "$PWD/camel-bots:/bots:ro" -v "$PWD/out:/out" \
     camel-runner --bots /bots --games 5000 --out /out/leaderboard.json
   ```

   - No network, no host directories except the bots (read-only) and one output folder.
   - No AWS credentials, no `.env`, no home directory inside the container. Publishing happens outside it, after it exits.
   - Treat `out/leaderboard.json` as untrusted too: validate it against the expected shape (and a sane size) before uploading.

4. **Publish**, outside the container:

   ```bash
   aws s3 cp out/leaderboard.json "s3://<asset-bucket>/images/camel-up/leaderboard.json" \
     --content-type application/json --cache-control "public,max-age=60"
   ```

   Then `npm run camel:queue -- done <ids>` in the site repo. If task 05 is done and the page is slow to update, the page itself is not cached (its loader reads live data), but the JSON is for 60 seconds.

5. **One wrapper script** that does pull → run in container → validate → show a diff of the standings → ask for confirmation → publish → mark done. The confirmation matters: the owner should see the new board before it goes live.

## Verify

- Run with only the house bots: the standings are close to the current live board.
- Add a deliberately bad bot (one that tries `import os`, one that sleeps 10 seconds in `move`, one that raises): each is rejected or penalised as the page promises, and the run completes.
- From inside the container, `curl example.com` fails and `ls /` shows nothing of the host.
- After publishing, `https://tylerbarron.com/camel-up-cup` shows the new entrant.

## Done when

The owner can go from the notification email to an updated public leaderboard with one command and one confirmation, and no submitted code ever runs outside the container.
