# Blunder Watch
### Daily Chess Blunder Detection Game
**Product Requirements Document · v1.1**

| | |
|---|---|
| **Status** | Draft |
| **Version** | 1.1 |
| **Author** | — |
| **Platform** | Web (Desktop + Mobile / iPhone) |

---

## 1. Overview

Blunder Watch is a daily, Wordle-style web game in which players watch a pre-analyzed chess game unfold in real time and press a single button to identify blunders as they occur. Each day, all players see the same game. Scores are submitted to a shared daily leaderboard that resets at midnight.

The game is designed to be fast, social, and skill-testing — rewarding players who can recognize poor moves quickly and penalizing false positives to discourage random guessing.

---

## 2. Goals & Non-Goals

### 2.1 Goals
- Deliver a single, shareable daily chess experience accessible from any browser or iPhone.
- Teach pattern recognition of blunders in a fun, low-commitment format (~5 min per session).
- Drive daily retention through a competitive leaderboard and Wordle-style results sharing.
- Keep the input mechanic dead simple: one button, no chess knowledge required to play.

### 2.2 Non-Goals
- This is not a chess engine, chess tutor, or full chess client.
- Players cannot make moves, alter the board, or affect game playback in any way.
- There is no multiplayer real-time interaction — competition is asynchronous via the leaderboard.
- Account creation is optional; a persistent profile system is out of scope for v1.

---

## 3. User Stories

- As a player, I want to know how many blunders are in today's game before it starts, so I can calibrate how many times I expect to press the button.
- As a player, I want moves to play out automatically so I can focus entirely on watching the position.
- As a player, I want moves with no blunders nearby to play quickly so the game doesn't waste my time on quiet stretches.
- As a player, I want immediate feedback after each press so I know if I was right or wrong.
- As a player, I want a shareable result card so I can post my score like a Wordle result.
- As a player on my iPhone, I want a large, thumb-friendly tap target so pressing the button mid-game is easy and natural.
- As a competitive player, I want to see how my score ranks against others who played today.

---

## 4. Game Design Specification

### 4.1 Game Source & Blunder Definition
- Each daily game is sourced from the **Lichess Cloud Analysis** dataset (the same data pipeline used by Chesser Guesser), targeting rated games between lower-Elo players (600–1200 Elo).
- Games are pre-analyzed using Stockfish (depth ≥ 20) prior to publication.
- A move is tagged as a blunder if the engine evaluation swings by ≥ 2.0 pawns in the opponent's favor compared to the previous position.
- Each daily game will contain between 7 and 10 pre-tagged blunders.
- Game selection and blunder tagging is a manual curation step performed before scheduling. Curated games are stored in DynamoDB via the existing Python data pipeline.

### 4.2 Pre-Game Screen

Before playback begins, the player is shown:
- Today's game identifier (e.g., "Game #47")
- Player Elo ratings and colors (e.g., "White: 874 vs Black: 912")
- Total number of blunders in the game (e.g., "There are 8 blunders in this game")
- A brief instruction reminder: "Press Space (or tap the button) when you spot a blunder"
- A "Start Game" button to begin playback

### 4.3 Move Playback & Pacing

Move timing is the core mechanic that keeps the game engaging. Two rules govern pacing:

#### Standard Pacing
- Each move in the middlegame is displayed for exactly 2 seconds before the next move plays.
- "Middlegame" is defined as the period between move 10 and the point at which one side has fewer than 4 non-pawn, non-king pieces remaining.
- Opening moves (1–9) play at 1 second per move; endgame moves play at 1.5 seconds per move.
- The player cannot pause, rewind, or fast-forward playback at any time.

#### Quiet Streak Acceleration
- If 10 or more consecutive moves pass without any tagged blunder, those moves enter "fast-forward" mode.
- In fast-forward mode, each move is displayed for 0.4 seconds rather than 2 seconds.
- Fast-forward mode ends and standard pacing resumes 2 moves before the next tagged blunder, giving the player time to re-orient before the critical moment.
- A subtle visual indicator (e.g., a speed icon or pulsing border) is shown during fast-forward to signal the accelerated pace.
- This rule applies globally, including the opening — it is a global override to prevent dead time in any part of the game.

### 4.4 Player Input
- The sole input is pressing the Space key (desktop) or tapping the Blunder Button (mobile/touch).
- Pressing Space/tapping the button flags the move that is currently on screen as a blunder.
- Only one flag is accepted per move — all subsequent presses during the same move are ignored.
- There is no grace period. A flag is only valid for the move currently being displayed. Once the next move appears, the previous move can no longer be flagged.
- The Blunder Button is always visible during playback on mobile — it is a large, fixed element in the lower portion of the screen accessible without scrolling.

### 4.5 Scoring

Scoring rewards both accuracy and speed. The reaction time window is measured from the moment a move appears on screen.

| Outcome | Condition | Points |
|---|---|---|
| Correct — Fast | Flag within 0.5s of move appearing | +100 pts |
| Correct — Medium | Flag between 0.5s and 1.0s | +75 pts |
| Correct — Slow | Flag between 1.0s and 2.0s | +50 pts |
| False Positive | Flag on a non-blunder move | −30 pts |
| Miss | Blunder passes with no flag | +0 pts (no penalty) |

- Score is updated and displayed live on screen after each flag.
- Scores cannot go below zero.

---

## 5. End of Game & Results

### 5.1 Results Screen

When the final move plays, playback ends and the Results Screen is shown immediately. It displays:
- Final score
- Breakdown: blunders correctly identified, blunders missed, false positives
- A replay section showing each tagged blunder with the board position, engine evaluation before/after, and whether the player flagged it correctly, late, or not at all
- A shareable result card (see 5.2)
- A link to the leaderboard

### 5.2 Shareable Result Card

Players can copy a Wordle-style text result to share on social media or messaging apps:

```
Blunder Watch #47 — 325/800
🟩🟨⬜🟩🟥🟩🟩⬜
8 blunders | 5 caught | 1 false positive
blunderwatch.com
```

Emoji key: 🟩 Correct fast · 🟨 Correct slow · ⬜ Missed · 🟥 False positive

---

## 6. Leaderboard

- Scores are automatically submitted to the daily leaderboard at game end.
- Players must enter a display name (≤ 20 characters, alphanumeric + underscores) to appear on the leaderboard. Anonymous play is permitted but the score is not listed.
- The leaderboard displays: rank, display name, score, blunders caught, and false positive count.
- The leaderboard resets at midnight UTC with each new daily game.
- Players can view leaderboards from previous days via an archive selector.
- Display name is stored in `localStorage` for convenience on repeat visits — the existing `UsernameModal` component from Chesser Guesser is reused for name entry.
- **Tiebreaking**: In the event of equal scores, fewer false positives wins. If still tied, earlier completion timestamp wins (matching Chesser Guesser's tiebreaking convention).

---

## 7. Acceptance Criteria

### 7.1 Game Data & Setup

| AC# | Acceptance Criteria | Priority |
|---|---|---|
| AC-01 | Each daily game contains between 7 and 10 pre-tagged blunder moves. | Must Have |
| AC-02 | Blunders are defined as moves where the engine evaluation shifts ≥ 2.0 pawns against the moving side. | Must Have |
| AC-03 | Games are sourced from players rated 600–1200 Elo. | Must Have |
| AC-04 | All players on a given day see the same game. | Must Have |
| AC-05 | The pre-game screen displays the total blunder count, player Elos, and instructions before playback starts. | Must Have |

### 7.2 Playback & Pacing

| AC# | Acceptance Criteria | Priority |
|---|---|---|
| AC-06 | Middlegame moves are displayed for exactly 2 seconds each before automatically advancing. | Must Have |
| AC-07 | Playback cannot be paused, rewound, or fast-forwarded by the player. | Must Have |
| AC-08 | If 10 or more consecutive moves pass without a tagged blunder, those moves play at 0.4 seconds per move. | Must Have |
| AC-09 | Fast-forward mode ends and 2-second pacing resumes 2 moves before the next tagged blunder. | Must Have |
| AC-10 | A visual indicator is shown on screen whenever fast-forward mode is active. | Should Have |
| AC-11 | Move notation is displayed alongside the board as each move is made. | Must Have |
| AC-12 | Piece movement is animated between source and destination squares. | Should Have |

### 7.3 Player Input

| AC# | Acceptance Criteria | Priority |
|---|---|---|
| AC-13 | Pressing Space (desktop) flags the move currently on screen as a blunder. | Must Have |
| AC-14 | Tapping the Blunder Button (mobile) flags the move currently on screen as a blunder. | Must Have |
| AC-15 | Only one flag is accepted per move; subsequent presses during the same move are ignored. | Must Have |
| AC-16 | A flag is only valid while the flagged move is actively on screen. There is no grace period — once the next move appears, the prior move cannot be flagged. | Must Have |
| AC-17 | The Blunder Button is always visible and accessible on mobile without scrolling during playback. | Must Have |

### 7.4 Scoring

| AC# | Acceptance Criteria | Priority |
|---|---|---|
| AC-18 | A correct flag submitted within 0.5s of the move appearing awards 100 points. | Must Have |
| AC-19 | A correct flag submitted between 0.5s and 1.0s awards 75 points. | Must Have |
| AC-20 | A correct flag submitted between 1.0s and 2.0s awards 50 points. | Must Have |
| AC-21 | A flag on a non-blunder move deducts 30 points. | Must Have |
| AC-22 | A missed blunder (no flag) results in 0 points with no penalty. | Must Have |
| AC-23 | Player score is displayed live on screen and updates immediately after each flag. | Must Have |
| AC-24 | Score cannot go below 0. | Must Have |

### 7.5 End of Game & Results

| AC# | Acceptance Criteria | Priority |
|---|---|---|
| AC-25 | The results screen is shown immediately after the final move plays. | Must Have |
| AC-26 | Results screen shows final score, blunders caught, blunders missed, and false positive count. | Must Have |
| AC-27 | A replay of each blunder position is shown with engine evaluation before and after the blunder move. | Should Have |
| AC-28 | Player can copy a shareable Wordle-style result text to clipboard with one tap/click. | Must Have |

### 7.6 Leaderboard

| AC# | Acceptance Criteria | Priority |
|---|---|---|
| AC-29 | Score is automatically submitted to the daily leaderboard at game end. | Must Have |
| AC-30 | Player must enter a display name (≤ 20 characters, alphanumeric + underscores) to appear on the leaderboard. | Must Have |
| AC-31 | Leaderboard shows rank, display name, score, blunders caught, and false positive count. | Must Have |
| AC-32 | Daily leaderboard resets at midnight UTC. | Must Have |
| AC-33 | Previous day leaderboards are accessible via an archive selector. | Should Have |
| AC-34 | Display name is persisted in localStorage for returning players. | Should Have |
| AC-35 | Ties are broken first by fewer false positives, then by earlier completion timestamp. | Should Have |

### 7.7 Platform & Accessibility

| AC# | Acceptance Criteria | Priority |
|---|---|---|
| AC-36 | Game is fully playable on Chrome, Safari, Firefox, and Edge (latest versions). | Must Have |
| AC-37 | Game is fully playable on iPhone Safari without requiring a native app install. | Must Have |
| AC-38 | Chess board scales to screen width on mobile; no horizontal scrolling is required. | Must Have |
| AC-39 | Board pieces are distinguishable without relying on color alone (color-blind accessibility). | Should Have |
| AC-40 | The Blunder Button tap target is at minimum 64×64pt on mobile. | Must Have |
| AC-41 | Page load time to game-ready state is under 3 seconds on a standard mobile connection. | Should Have |

---

## 8. Tech Stack & Architecture

### 8.1 Frontend Stack

Aligns with the existing site stack:

| Layer | Technology |
|---|---|
| Framework | React Router 7 (v7.9.0) |
| Language | TypeScript 5.x (strict mode) |
| Styling | Tailwind CSS 4 — no inline `style={{}}` objects |
| Chess board | Chessground (lichess-org/chessground) — same library used by Chesser Guesser |
| Build | Vite 8 |
| Deployment | AWS Architect |

**Typography**: `font-neo` (Inter) for all UI text, `font-mono` (IBM Plex Mono) for move notation and eval display.

**Design System**: Neobrutalist — white backgrounds, 4px black borders, bold uppercase labels, black/white hover inversions. Follow the visual patterns established in Chesser Guesser and Collaborative Checkmate.

**Route**: `app/routes/blunderWatch.tsx` (or `blunderWatch._index.tsx` if subroutes are needed for the game view)

### 8.2 Backend Architecture

Mirrors the Chesser Guesser backend model:

| Layer | Technology | Purpose |
|---|---|---|
| Game cache | Redis (ioredis v5.8.2) | Cache daily game, deduplicate submissions |
| Leaderboard | Redis ZSET | Real-time sorted leaderboard |
| Game archive | DynamoDB (existing Lambda) | Permanent game storage, historical lookup |
| Data pipeline | Python (existing) | Curate games from Lichess, tag blunders, push to DynamoDB |
| API runtime | AWS Lambda via Architect | React Router API routes |

Redis connection via `app/utils/redis.server.ts` (singleton, existing shared utility). All keys use the `blunderWatch:` namespace to avoid collisions with `chesserGuesser:` keys.

### 8.3 Redis Key Schema

```
blunderWatch:
  ├── dailyGame:{date}                  # Cached game + blunder annotations (TTL: 7d)
  ├── submission:{date}:{username}      # Completed game record, prevents replay (TTL: 7d)
  ├── leaderboard:{date}               # ZSET — score members (TTL: 7d)
  └── summary:{date}:{username}        # Cached user result (TTL: 7d)
```

**Daily Game schema** (`blunderWatch:dailyGame:{date}`):
```json
{
  "date": "2026-03-13",
  "gameNumber": 47,
  "whiteElo": 874,
  "blackElo": 912,
  "moves": ["e4", "e5", "Nf3", "..."],
  "blunderIndices": [12, 18, 23, 27, 31, 35, 40, 44],
  "evals": [15, 20, -210, -195, 230, ...]
}
```

**Submission schema** (`blunderWatch:submission:{date}:{username}`):
```json
{
  "username": "player123",
  "date": "2026-03-13",
  "score": 325,
  "blundersCaught": 5,
  "blundersMissed": 3,
  "falsePositives": 1,
  "resultEmoji": "🟩🟨⬜🟩🟥🟩🟩⬜",
  "timestamp": 1741824000000
}
```

**Leaderboard ZSET** (`blunderWatch:leaderboard:{date}`):
- Members: `{username}` strings
- Scores: total points (higher = better rank)
- Tiebreaking: stored timestamp used for secondary sort at query time

### 8.4 API Endpoints

Follows the `/api/chesserGuesser/` naming convention:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/blunderWatch/game` | Fetch today's game + blunder metadata |
| `POST` | `/api/blunderWatch/submit` | Submit final score at game end |
| `GET` | `/api/blunderWatch/leaderboard` | Fetch daily leaderboard |

**GET /api/blunderWatch/game**
- Query params: `date` (YYYY-MM-DD, optional — defaults to today UTC)
- Response: game moves, blunder count, Elo ratings, game number
- **Note**: blunder indices are NOT returned to the client — they are used server-side only to validate submissions. The client only receives move list and total blunder count.
- Cache: `Cache-Control: public, max-age=3600`

**POST /api/blunderWatch/submit**
- Body: `{ username, date, flags: [{ moveIndex, reactionTimeMs }] }`
- Server calculates score from flags vs. actual blunder indices
- Returns: `{ score, blundersCaught, blundersMissed, falsePositives, resultEmoji, totalPlayers }`
- Validates: username regex `/^[a-zA-Z0-9_]{3,20}$/`, date format, no duplicate submission

**GET /api/blunderWatch/leaderboard**
- Query params: `date` (optional), `limit` (1–100, default 50), `username` (optional, for rank injection)
- Response mirrors Chesser Guesser leaderboard format: `{ leaderboard, userRank, totalPlayers, date }`

### 8.5 Component Structure

Route file (`blunderWatch.tsx`) stays under 500 lines. Game logic is split into focused components under `app/components/BlunderWatch/`:

| Component | Responsibility |
|---|---|
| `GameBoard.tsx` | Chessground wrapper — move playback, orientation |
| `BlunderButton.tsx` | The primary input — fixed on mobile, keyboard listener on desktop |
| `PreGameScreen.tsx` | Game metadata display + Start button |
| `ResultsScreen.tsx` | Score breakdown, replay, share card |
| `BlunderReplay.tsx` | Per-blunder position review with eval display |
| `Leaderboard.tsx` | Daily leaderboard table (can be adapted from Chesser Guesser's) |

Shared/reused from Chesser Guesser:
- `UsernameModal` — display name entry + localStorage persistence
- `LeaderboardModal` — shown after game completion
- `Navbar`, `Footer`, `Article`, `Subarticle` — layout

Client state is managed in the route component via `useState`/`useReducer`. Display name persisted in `localStorage`. Game progress is **not** persisted mid-game — if the player navigates away, they start over (same as Endless mode in Chesser Guesser).

---

## 9. Out of Scope (v1)

- User accounts, authentication, or persistent profiles
- Push notifications or email reminders
- Custom difficulty selection or game filtering
- Native iOS or Android app
- Multiplayer or real-time head-to-head modes
- In-app game archive browser or user history
- Monetization, ads, or premium features

---

## 10. Open Questions

| # | Question | Status | Notes |
|---|---|---|---|
| Q1 | What platform will games be sourced from — Lichess, Chess.com, or both? | **Resolved: Lichess** | Lichess Cloud Analysis already powers Chesser Guesser. Reuse the same Python pipeline. |
| Q2 | Should fast-forward mode also apply to the opening (moves 1–9)? | **Resolved: Yes** | Openings are typically quiet. Fast-forward applies globally per Section 4.3. |
| Q3 | How should ties on the leaderboard be broken? | **Resolved: fewer false positives, then earlier timestamp** | Consistent with Chesser Guesser tiebreaking. See Section 6. |
| Q4 | What is the penalty cap — can repeated false positives zero out a score? | **Open** | AC-24 prevents sub-zero. UX question: should the UI warn when score hits 0 to discourage further guessing? |
