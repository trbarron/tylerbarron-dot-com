# Multiple Choice Chess — Design Document

## Overview

Multiple Choice Chess is a browser-based 1v1 chess game where each player selects from four engine-generated move options on their turn rather than choosing moves freely. The chess engine runs entirely client-side via WebAssembly. Game state is stored in the existing Redis instance and accessed through React Router resource routes — no separate game server is needed. The design is entirely trusting: the server relays and stores what clients submit without validating move choices against engine output.

---

## Architecture

```
Player 1 device                    AWS Lambda (React Router)      Player 2 device
─────────────────                  ──────────────────────────     ─────────────────
Stockfish (WASM)                   Resource route handlers        Stockfish (WASM)
chess.js                           Redis game state               chess.js
Chessground board   <── HTTP ──>   (FEN, turn, scores,      <── HTTP ──>   Chessground board
                      polling        last move, choices)           polling
```

Each player's device runs Stockfish locally only on their own turn. The server never touches the engine. Clients poll a state endpoint roughly every second while waiting for the opponent's move; polling stops while the local engine is analyzing or the player is choosing.

---

## Tech Stack

| Concern | Technology |
|---|---|
| Framework | React Router 7 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Chess logic | chess.js (already installed) |
| Board UI | Chessground (already installed) |
| Chess engine | Stockfish WASM via Web Worker |
| Backend | React Router resource routes on AWS Lambda (Architect) |
| State | Redis (existing instance) |
| Transport | HTTP polling (~1s interval) |

No new server or Fly.dev service is required.

---

## Frontend Routes

Mirrors the CollaborativeCheckmate route pattern.

### `multipleChoiceChess._index.tsx` — Lobby

- Enter a username
- Create a new game → receive a game code and shareable link
- Join by entering a code
- Quick match → server checks Redis for a waiting game and pairs immediately, or creates one and waits
- List of open games waiting for a second player (polled every 5s)

### `multipleChoiceChess.$gameId.$playerId.tsx` — Game

- Board oriented from the perspective of the assigned color
- **Active turn:** Stockfish analyzes locally for N ms, then 4 move buttons appear in shuffled order. Player picks one. Chosen move + rank + all 4 choices are POSTed to the move endpoint.
- **Waiting turn:** Board is view-only. "Opponent is choosing..." shown. Client polls game state every 1s and updates when `last_updated` changes.
- **Post-move feedback:** After any move (yours or opponent's), the 4 choices and chosen rank are shown color-coded briefly before the next turn begins.
- Game continues until checkmate, stalemate, or resignation.

---

## Frontend Component Structure

```
app/routes/
  multipleChoiceChess._index.tsx
  multipleChoiceChess.$gameId.$playerId.tsx

app/components/MultipleChoiceChess/
  MoveChoices.tsx          # Four move buttons, shuffled, color-revealed post-pick
  EngineStatus.tsx         # "Analyzing..." spinner while Stockfish runs
  ResultFeedback.tsx       # Post-pick quality banner (green/yellow/orange/red)
  ScorePanel.tsx           # Running score and accuracy % for both players
  GameOverModal.tsx        # Checkmate / draw / resignation summary

app/utils/multipleChoiceChess/
  stockfishEngine.ts       # Web Worker wrapper with Promise-based API
  moveParser.ts            # Parse MultiPV output lines into ranked move list
  scoring.ts               # Points per rank, accuracy calculation
```

Reuses: `Chessboard.tsx`, `Navbar`, `Footer`, `Article`, Chessground CSS files.

---

## Resource Routes (API)

All routes live under `app/routes/api/multipleChoiceChess/` and are accessed via standard `fetch` calls from the client.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/multipleChoiceChess/create` | Create a game in Redis, return `{ game_id, player_id, color: "white" }` |
| `POST` | `/api/multipleChoiceChess/join` | Join by code or dequeue from matchmaking; return `{ player_id, color: "black" }` |
| `GET` | `/api/multipleChoiceChess/state/:gameId` | Return full game state; polled every ~1s while waiting |
| `POST` | `/api/multipleChoiceChess/move` | Write move + rank + choices to Redis |
| `POST` | `/api/multipleChoiceChess/resign` | Set game status to complete with result |
| `GET` | `/api/multipleChoiceChess/available` | List games with status `waiting` |

---

## Redis Schema

All game state lives in a single hash per game, with a 24-hour TTL to clean up abandoned games automatically.

```
game:multipleChoiceChess:{gameId}  (Hash, TTL 24h)
  fen               string    current board position
  turn              string    "white" | "black"
  white_id          string    player ID
  black_id          string    player ID (empty until second player joins)
  white_score       number
  black_score       number
  white_moves       number
  black_moves       number
  status            string    "waiting" | "active" | "complete"
  result            string    "white" | "black" | "draw" | ""
  result_reason     string    "checkmate" | "stalemate" | "resignation" | "draw" | ""
  last_move         string    UCI notation e.g. "e2e4"
  last_move_rank    number    1 | 2 | 4 | 6
  last_move_choices string    JSON array of four UCI moves
  created_at        number    Unix timestamp
  last_updated      number    Unix timestamp (client compares this to detect new moves)

multipleChoiceChess:available  (Sorted Set, score = created_at)
  members: game_id strings    games with status "waiting"
```

---

## Stockfish Integration

### Initialization

Load Stockfish as a Web Worker using the `stockfish` npm package (WASM build). Initialize once when the game page mounts. Show a loading indicator until the engine responds to `uci`.

### Analysis

When it is the local player's turn:

```
ucinewgame                          (on first move only)
setoption name MultiPV value 6
position fen <current FEN>
go movetime <think_time_ms>
```

Collect the last `info ... multipv N ...` line for each N as they arrive. On `bestmove`, the analysis is complete. Extract moves at ranks 1, 2, 4, and 6.

### Think Time

| Condition | Think time |
|---|---|
| Default | 2000 ms |
| `navigator.hardwareConcurrency < 4` | 1000 ms |

The WASM binary (~15 MB) is cached by the browser after first load. Show a one-time loading notice on initial visit.

### Move Representation

Each of the 4 candidate moves is:
- Converted from UCI notation (`e2e4`) to standard algebraic notation (`e4`) via chess.js
- Displayed as a button with the piece type and destination square
- On tap/hover: origin and destination squares are highlighted on the board via a Chessground arrow shape

---

## Polling Behavior

| Client state | Polling |
|---|---|
| Waiting for opponent to move | Poll `/state/:gameId` every 1000ms |
| Engine analyzing locally | Stop polling |
| Player choosing from 4 options | Stop polling |
| Animating post-move feedback | Stop polling |
| Game over | Stop polling |

On each poll response, compare `last_updated` to the previously seen value. If changed, update the board, scores, and feedback display. This avoids unnecessary re-renders on unchanged responses.

---

## Scoring

| Engine rank chosen | Points |
|---|---|
| 1st best | 4 |
| 2nd best | 3 |
| 4th best | 2 |
| 6th best | 1 |

**Accuracy** = `(total points earned) / (moves played × 4) × 100`

Both scores are stored in Redis and returned on every state poll. The game result (win/loss/draw) is independent of score — it is possible to lose the match while outscoring the opponent in move quality.

Post-pick, the four move buttons briefly reveal their rank via color before the next turn begins:

| Rank | Color |
|---|---|
| 1st (best) | Green |
| 2nd | Yellow |
| 4th | Orange |
| 6th | Red |

---

## Game Flow

```
1. Player 1 opens lobby → creates game → copies shareable link
2. Player 2 opens link → joins game (status: waiting → active)
3. Player 1 is assigned white, Player 2 black

Loop:
  Active player's device:
    - Stop polling
    - Engine analyzes locally (spinner shown, board view-only)
    - 4 buttons appear in shuffled order
    - Player picks
    - POST /move with { move, rank, choices }
    - Redis updated: new FEN, turn flipped, last_updated bumped
    - Post-pick feedback shown briefly
    - Resume polling (now waiting for opponent)

  Waiting player's device:
    - Polling detects last_updated changed
    - Move animates on board
    - Opponent's choices and rank shown as color-coded feedback
    - Stop polling, run engine for own turn

Until: checkmate / stalemate / resignation → status set to "complete"
```

---

## Matchmaking

**Link-based (primary):** Player 1 creates a game and shares the URL. The URL encodes the game ID and player ID. Player 2 visits the URL and is joined automatically.

**Quick match:** On join request with no game code, the server checks `multipleChoiceChess:available`. If a game exists, join it. If not, create one and add it to the set — the lobby page polls available games and shows it to the creator while they wait.

---

## Disconnection Handling

Because the transport is polling rather than WebSockets, disconnection is implicit — the server never knows a client is gone. This simplifies handling significantly:

- If a player closes the tab and returns, they resume by navigating back to the game URL. The current state is fetched immediately from Redis.
- No reconnection logic, heartbeats, or exponential backoff needed.
- Games with status `active` that have not received a move for more than 10 minutes can be treated as abandoned by the rejoining player (show a "your opponent may have left" message), but no automatic forfeit is applied.

---

## Mobile Considerations

- Board sizing: same responsive `aspect-square w-full` pattern as existing chess routes
- Move buttons: large tap targets, minimum 48px height, stacked vertically on small screens
- Engine think time reduced automatically on low-`hardwareConcurrency` devices
- No drag-and-drop required — all interaction is button taps
- First-load notice for the ~15 MB WASM engine download

---

## Phased Implementation

### Phase 1 — Resource Routes + Redis
API routes for create, join, state, move, resign, and available. Redis schema. Matchmaking logic.

### Phase 2 — Lobby
`_index` route: create game, join by code, quick match, available games list.

### Phase 3 — Game Board
Stockfish WASM integration, 4-choice UI, polling loop, move submission, post-pick feedback.

### Phase 4 — Polish
Shareable link flow, game-over modal with score summary, resignation button, abandoned game detection.
