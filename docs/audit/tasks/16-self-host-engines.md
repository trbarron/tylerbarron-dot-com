# 16 — Serve Stockfish and the ONNX runtime from the site itself

|            |                    |
| ---------- | ------------------ |
| Finding    | S6.2               |
| Needs      | Repo only          |
| Risk       | Medium. Every chess tool depends on the engine loading. |
| Size       | 1 day              |
| Depends on | Nothing            |

## Why

The browser loads two engines from third-party CDNs at runtime:

- **Stockfish** from `https://unpkg.com/stockfish@18.0.7/bin/…` (`app/utils/chess/stockfish.ts`). Used by Multiple Choice Chess, Blunder Watch, Chesser Guesser's helpers and Maia Drills.
- **onnxruntime-web** from `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/…` (`app/utils/maiaDrills/maiaEngine.ts`). Used by Maia Drills only.

That is why `script-src` in `app/utils/csp.server.ts` allows `https://unpkg.com` and `https://cdn.jsdelivr.net`. If either CDN is compromised or down, so are the tools. The server already verifies Stockfish with pinned SHA-256 hashes (`app/utils/chess/stockfish.server.ts`); the browser has no equivalent.

The comment at the top of `stockfish.ts` explains the original reason for unpkg: the 7.3 MB WASM exceeded API Gateway's 6 MB response limit when the Lambda served assets. Assets now come from the S3 bucket through CloudFront (`/assets/*`), which has no such limit, so the reason no longer applies.

## The change

Have Vite emit the engine files into `/assets/` with content hashes.

**Stockfish**

- The files are in the `stockfish` devDependency: `node_modules/stockfish/bin/stockfish-18-lite-single.js` and `.wasm`.
- Import them as URLs: `import engineUrl from 'stockfish/bin/stockfish-18-lite-single.js?url'` and the same for the `.wasm`. Vite copies each to `/assets/<name>-<hash>.<ext>`.
- `createStockfishWorker()` can then be `new Worker(engineUrl + '#' + encodeURIComponent(wasmUrl))`: same-origin, so the blob bootstrap is no longer needed. Read the long comment on that function first; the hash format and the warning about `,worker` still apply.
- The **server** keeps downloading from unpkg and checking hashes; do not change `stockfish.server.ts`. The `stockfish` package must stay a devDependency (it is 251 MB; it must never reach `server/package.json`).
- `STOCKFISH_VERSION` is "pinned everywhere". After this change the browser's version is whatever the devDependency is, and the server's is the constant. Add a test that fails if `node_modules/stockfish/package.json`'s version differs from `STOCKFISH_VERSION`.

**onnxruntime-web**

- Add `onnxruntime-web@1.30.0` as an exact-version devDependency. Do not bump it: the comment in `maiaEngine.ts` records that 1.22's WebGPU backend computed wrong results.
- The worker is built from a string (`WORKER_SOURCE`) and calls `importScripts(ORT_BASE + …)`, then sets `ort.env.wasm.wasmPaths = ORT_BASE` so the runtime fetches its own `.mjs` and `.wasm` files by name from that base. Those files must therefore sit together in one directory with their **original names**, which hashed Vite imports do not give you.
- Simplest: copy the needed `dist` files to `public/ort/1.30.0/` at build time with a small Vite plugin or a `prebuild` script, and set `ORT_BASE = '/ort/1.30.0/'`. Add `/ort/*` to the CloudFront behaviors and the deploy sync, **or** put them under `public/images/…`/`public/fonts/…`'s neighbours that are already routed to the bucket. Adding a behavior is an AWS change (see task 05 for how to edit the distribution safely). The version in the path makes the files safe to cache forever.
- Which files: load the Maia page with the network tab open, once on a WebGPU browser and once on one without, and list what it fetches from jsDelivr. Copy exactly those.

**CSP** (`app/utils/csp.server.ts`)

- Remove `https://unpkg.com` and `https://cdn.jsdelivr.net` from `script-src` once nothing loads scripts from them.
- `connect-src` keeps `https://cdn.jsdelivr.net`: the pizza map fetches US state boundaries from it (`app/components/PizzaScoringMap.tsx`). Remove `https://unpkg.com` from `connect-src`.
- `blob:` in `script-src` and `worker-src` stays: `app/components/Timer.tsx` uses a blob worker, and the Maia worker is still built from a string.
- Update `tests/utils/csp.test.ts` and the comment block in `csp.server.ts`.

## Verify

- `npm run lint && npm run typecheck && npm run format:check && npm test`.
- `npm run build && npm run build:arc:server && npm run build:arc:deps && npm run check:lambda-deps`. Confirm the Stockfish files are in `build/client/assets/` and **not** in `build/server/`, and that the Lambda is not much larger (`du -sh server`).
- In a browser against the production build, with the network tab open:
  - Multiple Choice Chess: create a game, four moves are offered.
  - Blunder Watch and Chesser Guesser load and play.
  - Maia Drills: build a small deck from a Lichess username and let the analysis run, on a WebGPU browser and a non-WebGPU one.
  - No request goes to unpkg; the only jsDelivr request is `us-atlas` on the pizza page.
  - The console shows no Content-Security-Policy errors.
- Update `docs/deployment.md` ("Stockfish in the Lambda") and the header comments in `stockfish.ts`.

Commits: `perf(chess): …` for Stockfish, `perf(maia): …` for the runtime. Two PRs.

## Done when

The chess tools work with unpkg and jsDelivr blocked in the browser (except the pizza map's boundaries), and `script-src` lists neither.
