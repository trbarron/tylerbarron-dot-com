# Maia Drills

Turn your own games into flashcards: positions where a player a bit stronger than you would have played something different, and the difference actually mattered.

Route: `/maia-drills` · Status: v1

## The idea

[Maia](https://www.maiachess.com/) is a neural net trained to predict the move a *human* of a given rating would play, not the best move. That makes it a good stand-in for "you, but N points better". So:

1. Pull a few hundred of your games from Lichess or Chess.com. Pasted PGN isn't supported: without a site's ratings there's no baseline to add Δ to.
2. For every move you played, ask Maia what a player at **your rating + Δ** (default 200) would have played in that position, against the same opponent rating.
3. If Maia's move differs from yours, ask Stockfish to evaluate both. If Maia's move is better by at least **T centipawns** (default 150), that position is an **error**: a card.
4. Drill the cards: the board is shown from your side, you play a move, and you find out whether you found the stronger player's move.

The pair of knobs (Δ, T) is the whole product. A small Δ with a big T finds outright blunders a slightly better you would avoid. A big Δ with a small T finds subtler "a 2000 plays this" habits.

### Why Maia *and* Stockfish

- Stockfish alone flags every inaccuracy, including ones no human at your level would find. That makes for noisy, demoralizing cards.
- Maia alone flags every stylistic difference, including equal alternatives. That makes for wrong cards.
- Only flagging where they agree gives you errors that matter *and* that are within reach.

## Where things run

| Step | Where | Notes |
|---|---|---|
| Fetch games | Browser → Lichess / Chess.com public APIs | Both send CORS headers; no proxy needed. |
| Maia inference | Browser, Web Worker, `onnxruntime-web` (WebGPU, else WASM) | ORT 1.30 is loaded from jsDelivr; the model from Hugging Face. |
| Stockfish | Browser, pool of Web Workers | Same lite single-threaded build Multiple Choice Chess uses. |
| Decks | Redis via `/api/maiaDrills/decks` | Only the finished cards are uploaded. No games and no analysis are sent to the server. |

These third-party hosts are granted in the CSP in `app/entry.server.tsx`: `lichess.org`, `api.chess.com`, `huggingface.co` plus `*.hf.co` (the model URL redirects to HF's storage CDN) in `connect-src`, and jsDelivr in `script-src`. Without them the page fails with a bare "Failed to fetch".

Nothing heavy touches the Lambda. The model (~44 MB) and the ORT wasm (~11 MB) are both over API Gateway's 6 MB response cap, and neither lives in this repo.

### The model

- Maia-3, 23M parameters, fp16 weights / fp32 I/O: `huggingface.co/bqrio/maia3-onnx`, file `maia3-23m.fp16.onnx` (~44 MB), pinned to commit `923df9a`. The repo belongs to a third party, so the URL names a revision rather than `main`; an upload there can't silently change Maia. This appears to be the same graph maiachess.com serves (`maia3_simplified.onnx`, 45.7 MB).
- Inputs are `tokens [B,64,12]`, `elo_self [B]` and `elo_oppo [B]`. Ratings are **continuous**: no 100-point buckets like Maia-2, so "rating + 137" means something.
- The encoding is in `app/utils/maiaDrills/maiaEncoding.ts`. It was checked against the real model in Node: the vocabulary matches the Maia platform's `all_moves_maia3_reversed.json` index for index, and outputs are sensible and rating-sensitive. For example, after 1.e4 at 2200 the top replies are c5 (27%) then e5; at 800 it's e5 (60%).
- Cached after first load with the Cache Storage API, so the download happens once per browser.
- License: the Maia-3 weights are AGPL-3.0. We load them at runtime from Hugging Face rather than redistribute them.

### Ratings

- Your rating for each game is the rating the site recorded for that game, so a deck spanning a rating climb uses the right baseline for each game. A game with no rating for you is skipped.
- Maia was trained on **Lichess** ratings. Chess.com ratings run lower at most levels, so for Chess.com games consider a larger Δ. The UI says so; we don't try to convert.
- The target rating is clamped to 600–2600, the range where Maia's training data is dense.

## Error definition (exact)

For each position `P` in which the user is to move and played `u`:

1. `m = argmax Maia(P, elo_self = userElo + Δ, elo_oppo = oppElo)`
2. If `m == u`: not an error.
3. Otherwise run Stockfish on `P` with `searchmoves m u`, `MultiPV 2`, at fixed depth (default 12). Both scores come from one search, from the mover's point of view.
4. Clamp each score to ±1000 cp (mate = ±1000). Otherwise every move in a won position is a "1500 cp error" against mate-in-3.
5. `loss = score(m) − score(u)`. Card if `loss ≥ T`.

Optional filters: skip the first N moves of each game (default 0, since the opening is often where the habits are), and skip bullet games.

**Drill grading:** you get two tries per card. A first miss just resets the board, with no hint. A second miss, or *Show answer*, reveals the answer. Only a first-try answer counts as answered right; a second-try answer comes back sooner, like a miss. Playing `m` is correct. Playing anything else triggers a quick Stockfish check of your move against `m` at the same depth. If it scores within 30 cp of `m` (or better), it's accepted as "also good"; a stronger player's choice isn't the only right answer.

## Storage

Redis, namespace `maiaDrills:`:

```
maiaDrills:deck:{id}                  JSON deck (TTL 30 days unless favorited)
maiaDrills:edit:{id}                  sha256 of the deck's edit token (same TTL)
maiaDrills:favorites                  ZSET of favorited deck ids, scored by when they were favorited
ratelimit:maiaDrills:{bucket}:{ip}:{window}
```

- Saving a deck mints an id plus a secret edit token, the same pattern as the Media Profile share cards. The browser that processed the games keeps the token in `localStorage`, and only that token can favorite or unfavorite.
- **Favoriting** persists the deck (removes the TTL) and adds it to one **global** favorites list, shown to every visitor at the bottom of the build page with the player's name on each deck. It's global on purpose: traffic is low, there are no accounts, and a per-player list could be filled by anyone who builds decks from that player's public games. Favorites open on any device with no reprocessing.
- The list keeps the 50 most recently favorited decks. Favoriting a 51st drops the oldest off the list, and that deck gets its 30-day expiry back, so nothing is blocked and nothing is kept forever off the list.
- **Adding games.** A deck records when its newest analyzed game was played (`newestGameAt`). On the deck page, the browser that built it can *Add new games*: it fetches only games after that (Lichess `since`, which is inclusive, so +1 ms; for Chess.com it walks monthly archives newest-first and stops at the first month that reaches it). The new games are analyzed with the deck's own settings and bullet choice, and the cards are sent to `PATCH`. The server does the merge, so a stale page can't drop cards: it skips cards it already has (same game and ply), keeps the 400 biggest misses, sums the stats, and moves `newestGameAt` forward. A stopped run sends its cards but not a new date, so the next add looks at those games again. An add restarts an unfavorited deck's 30 days.
- Per-card drill progress (seen / correct / last result) lives in `localStorage`, keyed by card id. Ids are stable across adds, so progress survives them. It's a convenience, not a record.
- Limits: 400 cards per deck, 50 decks on the favorites list, 20 deck saves per IP per hour.

## API

| Method | Path | Body / query | Returns |
|---|---|---|---|
| `POST` | `/api/maiaDrills/decks` | deck (settings + cards) | `{ id, editToken }` |
| `GET` | `/api/maiaDrills/decks?id=` | | `{ deck }` |
| `GET` | `/api/maiaDrills/decks` | | `{ decks: DeckSummary[] }` (the global favorites list) |
| `PUT` | `/api/maiaDrills/decks` | `{ id, editToken, favorite }` | `{ id, favorite }` |
| `PATCH` | `/api/maiaDrills/decks` | `{ id, editToken, cards, stats, newestGameAt? }` | `{ added, cardCount, newestGameAt }` (merge new games' cards in) |

## Cost of processing

Maia runs on the GPU through WebGPU where the browser supports it, and otherwise on the CPU through WASM. Measured in Chrome on a laptop, with the same 439 positions on both:

| | Per game (~44 moves) | Agrees with CPU on the top move |
|---|---|---|
| WASM (CPU, single thread) | ~2.9 s | (reference) |
| WebGPU, ORT 1.30 | ~0.28 s | 48/48 in a direct check |
| WebGPU, ORT 1.22 | ~0.3 s | **4/48**: wrong, and fp32 weights didn't help |

- **ORT must be 1.30 or later.** 1.22's WebGPU backend miscomputes this graph without raising an error. (1.27 was close at 47/48.)
- **GPU results are checked before they're trusted.** Driver and runtime bugs produce confident nonsense rather than errors, so the engine first runs three positions with unambiguous human answers (the start position, the reply to 1.e4, and a back-rank mate in one). If any comes back wrong, it falls back to the CPU. This was verified by pointing it at 1.22: the check failed and it switched to the CPU.
- On WebGPU, **Stockfish is the bottleneck** again: 8 games took ~18 s end to end, with Maia finished well before the Stockfish checks. Lowering the default depth from 12 is the next lever if 200 games feels slow.
- CPU-only browsers take ~3 s per game, so roughly 10 minutes for 200 games. The progress panel says which backend is in use, and on the CPU suggests a faster setup.
- **Phones and tablets always use the CPU** and at most two Stockfish workers (`app/utils/maiaDrills/device.ts`). On an iPhone, WebGPU failed to start every time; the attempt loaded the larger GPU runtime and the whole model just before the CPU fallback needed its memory, and iOS killed the tab. Android was never seen to fail but gets the same treatment, since a phone has far less memory to spare than a computer. On the CPU, Maia runs batches of 16 (a ~157 MiB WASM heap, against ~227 MiB for 64, at the same speed) and runs one at startup, before Stockfish loads, so the heap peaks while it's the only engine.
- The model download (~46 MB) happens once and is then served from Cache Storage. The WebGPU runtime is a larger download than the CPU one, so browsers without a GPU adapter get the small one.
- Processing can be cancelled, and the cards found so far are still saved.

## Out of scope for v1

- Spaced repetition scheduling (cards are shuffled; misses come back sooner in the session).
- Server-side processing.
- Accounts. The only identity is "the browser that holds the edit token", and it's needed only to favorite or unfavorite.
- Converting Chess.com ratings to Lichess ratings.

## Open questions

- Is 30 days the right TTL for unfavorited decks, or should unfavorited decks not be stored at all? (The current answer keeps "save" and "favorite" distinct, so a deck you just built survives a page reload.)
- Should a card require Maia to be *confident* (e.g. top move ≥ 30%)? This is easy to add as a third knob if the cards are noisy.
