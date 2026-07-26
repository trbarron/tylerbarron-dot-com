# Blunder Watch — Build To-Do

Legend: **👤 You** = manual step required &nbsp;|&nbsp; **🤖 Claude** = I build it

---

## Phase 1 — Data Pipeline

> Gets games into DynamoDB so the app has something to serve.

- [ ] **👤** Source 20–30 candidate games from Lichess (target: 600–1200 Elo rated games, at least 30 moves)
  - Export as PGN files, one game per file
  - Lichess game export: `https://lichess.org/games/export/{username}` or use the Lichess API
- [ ] **👤** Run Stockfish analysis on each game (depth ≥ 20) and annotate eval at every half-move
  - Recommended: use `python-chess` + local Stockfish binary, or the Lichess Cloud Analysis bulk export if already analyzed
- [ ] **👤** Tag blunders: flag any move where eval swings ≥ 2.0 pawns against the moving side
  - Discard games with fewer than 7 or more than 10 blunders
  - Aim to curate at least 30 valid games to give yourself a backlog
- [ ] **👤** Format curated games as JSON and load into DynamoDB
  - Schema per game record:
    ```json
    {
      "gameId": "bw-047",
      "date": "2026-03-20",
      "whiteElo": 874,
      "blackElo": 912,
      "moves": ["e4", "e5", "Nf3", "..."],
      "blunderIndices": [12, 18, 23, 27, 31, 35, 40, 44],
      "evals": [15, 20, -210, -195, 230, "..."]
    }
    ```
  - Use the existing DynamoDB table pattern from the Chesser Guesser Python pipeline as a reference

---

## Phase 2 — Backend API

> Three API routes, Redis caching, follows `/api/chesserGuesser/` patterns exactly.

- [ ] **🤖** Create `app/api/blunderWatch/game.ts`
  - `GET /api/blunderWatch/game?date=YYYY-MM-DD`
  - Checks Redis `blunderWatch:dailyGame:{date}` first
  - On miss: fetches from DynamoDB Lambda, caches with 7-day TTL
  - Returns moves, Elos, game number, blunder **count only** — blunder indices are never sent to client
  - `Cache-Control: public, max-age=3600`
- [ ] **🤖** Create `app/api/blunderWatch/submit.ts`
  - `POST /api/blunderWatch/submit`
  - Accepts `{ username, date, flags: [{ moveIndex, reactionTimeMs }] }`
  - Fetches blunder indices from Redis/DynamoDB server-side
  - Calculates score (scoring table from PRD §4.5)
  - Writes `blunderWatch:submission:{date}:{username}` — 409 on duplicate
  - Updates `blunderWatch:leaderboard:{date}` ZSET
  - Returns score breakdown + result emoji string
- [ ] **🤖** Create `app/api/blunderWatch/leaderboard.ts`
  - `GET /api/blunderWatch/leaderboard?date=&limit=50&username=`
  - Redis ZREVRANGE for top N, ZREVRANK for user rank injection
  - Response matches Chesser Guesser leaderboard shape
  - `Cache-Control: public, max-age=60`
- [ ] **👤** Add `BLUNDER_WATCH_TABLE` (or equivalent) env var to `.env` and Architect config pointing to the DynamoDB table

---

## Phase 3 — Components

> All go in `app/components/BlunderWatch/`. Each file targets < 500 lines.

- [ ] **🤖** `PreGameScreen.tsx` — game metadata (game #, Elos, blunder count), instructions, Start button
- [ ] **🤖** `GameBoard.tsx` — Chessground wrapper for playback-only mode (no user moves); accepts `fen` + `orientation`; reuses CSS imports from Chesser Guesser
- [ ] **🤖** `BlunderButton.tsx` — large fixed button on mobile, Space key listener on desktop; emits `onFlag` callback with current timestamp; disabled between moves and after one flag per move
- [ ] **🤖** `PlaybackEngine.tsx` (or hook `usePlayback.ts`) — manages move index, timing intervals, fast-forward logic, exposes current move state to parent
- [ ] **🤖** `ScoreBug.tsx` — live score display shown during playback (score + last flag outcome)
- [ ] **🤖** `ResultsScreen.tsx` — final score, breakdown table, share button, link to leaderboard
- [ ] **🤖** `BlunderReplay.tsx` — scrollable list of each blunder position: board thumbnail, eval before/after, player's outcome (caught/missed/false positive)
- [ ] **🤖** `Leaderboard.tsx` — adapt from `app/components/ChesserGuesser/Leaderboard.tsx`; swap endpoint and column names (blunders caught, false positives instead of score breakdown)

Reused as-is (no changes needed):
- `UsernameModal` — display name entry + localStorage
- `LeaderboardModal` — shown after submit
- `Navbar`, `Footer`, `Article`, `Subarticle`

---

## Phase 4 — Route & Game Logic

- [ ] **🤖** Create `app/routes/blunderWatch.tsx`
  - Loader: fetches today's game from `/api/blunderWatch/game`
  - Orchestrates state machine: `pregame → playing → submitted → results`
  - Wires `usePlayback`, `BlunderButton`, flag collection, submit call
  - Renders leaderboard section below game (same two-article layout as Chesser Guesser)
- [ ] **🤖** `app/utils/blunderWatch/scoring.ts` — pure scoring function given flags[], blunderIndices[], and reactionTimes[]
- [ ] **🤖** `app/utils/blunderWatch/resultEmoji.ts` — generates Wordle-style emoji string from result breakdown
- [ ] **🤖** `app/utils/blunderWatch/localStorage.ts` — `loadUsername` / `saveUsername` (can share with Chesser Guesser util if refactored, otherwise copy pattern)
- [ ] **🤖** Register route in `app/routes.ts`

---

## Phase 5 — Polish & Mobile

- [ ] **🤖** Ensure Blunder Button is `position: fixed` bottom-center on mobile, ≥ 64×64pt tap target
- [ ] **🤖** Board scales to 100% width on mobile with no horizontal scroll
- [ ] **🤖** Fast-forward visual indicator (pulsing border or ⚡ icon on board)
- [ ] **🤖** Immediate flag feedback — brief green flash (correct) or red flash (false positive) on button / board border
- [ ] **🤖** Clipboard share via `navigator.clipboard.writeText` (same pattern as Chesser Guesser FEN copy)
- [ ] **🤖** "Already played today" state — if `blunderWatch:submission:{date}:{username}` exists on load, skip to results

---

## Phase 6 — Quality & Deploy

- [ ] **🤖** Run `npm run typecheck` — fix all type errors
- [ ] **🤖** Run `npm run lint` — fix all lint warnings
- [ ] **👤** Test on iPhone Safari — verify Blunder Button tap target and board scaling
- [ ] **👤** Play through one complete daily game end-to-end and verify leaderboard entry appears
- [ ] **👤** Manually schedule the first 7+ days of games in DynamoDB so there's a backlog on launch
- [ ] **👤** Merge to master → CI/CD deploys to AWS

---

## Backlog / Post-Launch

- [ ] Previous day leaderboard archive selector (AC-33)
- [ ] Blunder replay thumbnails using static board screenshots
- [ ] Colorblind-accessible piece set (AC-39)
- [ ] Rate limiting on submit and leaderboard endpoints
- [ ] Timezone config for daily reset (currently UTC midnight)
