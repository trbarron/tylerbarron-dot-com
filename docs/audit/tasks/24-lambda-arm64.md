# 24 — Run the Lambda on arm64

|            |                           |
| ---------- | ------------------------- |
| Finding    | D9                        |
| Needs      | Repo change; a deploy to test |
| Risk       | Low to medium. Easy to revert. |
| Size       | 1 hour plus observation   |
| Depends on | 08 recommended            |

## Why

`app.arc` sets `architecture x86_64`. Lambda on arm64 (Graviton) is billed about 20% less per GB-second and is usually no slower. Nothing the Lambda ships has native code: `server/package.json` lists pure-JavaScript packages, and the server-side Stockfish is WebAssembly.

## Steps

1. Confirm there is no native code in what ships:

   ```bash
   npm run build:arc
   find server/node_modules -name '*.node' -o -name 'binding.gyp' | head
   ```

   Expect no output. If anything is listed, stop and report it.

2. In `app.arc`, under `@aws`, change `architecture x86_64` to `architecture arm64`.

3. The deploy job in `.github/workflows/deploy.yml` sets `architecture: x64` on `actions/setup-node`. That is the **runner's** architecture, used to build. Leave it: the build output is JavaScript and does not depend on it.

4. Open a PR with this change alone (`perf: …`, which releases a patch) so it can be reverted by itself.

## Verify after the deploy

- `aws lambda get-function-configuration --region us-west-2 --function-name <site-function> --query Architectures` shows `arm64`.
- `/healthcheck` returns `OK`; a blog post, `/multiple-choice-chess` and `/pizza-rating` return 200 to a bot user agent.
- The one thing that runs differently is server-side Stockfish, used when Collaborative Checkmate teammates disagree (`app/utils/chess/stockfish.server.ts` downloads the engine to `/tmp` and runs it as WebAssembly). Play a four-seat game where the two teammates pick different moves and confirm the engine decides. Check the Lambda's logs for errors from that file.
- Compare `Duration` in CloudWatch for a day before and after. If p50 or p95 is clearly worse, revert.

## Roll back

Revert the one-line change and deploy.

## Done when

The function reports `arm64`, the Stockfish check passes, and a day's durations are no worse.
