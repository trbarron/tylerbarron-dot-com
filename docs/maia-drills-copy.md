# Maia Drills — copy

Every string a visitor can see, grouped by where it appears. Fill in **Yours** for anything you want changed and leave it blank to keep the current text. I'll apply the changes.

- `{curly}` marks a value filled in at runtime. Keep the placeholder; you can move it around.
- **Bold** in the current text is rendered bold.
- Labels are uppercased by CSS, so their case doesn't matter.

## Around the site

| # | Where | Current | Yours |
|---|---|---|---|
| S1 | Browser tab / share title | Maia Drills | |
| S2 | Search + share description | Flashcards from your own games: the positions where a slightly stronger player would have found a better move. | |
| S3 | Homepage project card | Flashcards from the moves a slightly stronger you would have played | |

## Intro (top of the page, always shown)

| # | Current | Yours |
|---|---|---|
| I1 | Maia Drills *(heading)* | |
| I2 | Flashcards from your own games. For each move you made, Maia predicts what a player a bit stronger than you would have played. Where that move differs from yours and Stockfish says it was clearly better, the position becomes a card. *("Maia" links to maiachess.com)* | |
| I3 | Everything runs in your browser: a one-time ~44 MB model download, then a few minutes of analysis for a couple of hundred games. Only the finished cards are saved. | |

## Build a deck

| # | Current | Yours |
|---|---|---|
| B1 | Build a deck *(panel title)* | |
| B2 | Lichess · Chess.com *(source tabs)* | |
| B3 | Username *(label)* | |
| B5 | Games *(label)* | |
| B9 | What counts as an error *(box title)* | |
| B10 | Rating gap (+ points) *(label)* | |
| B11 | Min. difference (centipawns) *(label)* | |
| B12 | A move is an error when a player **{delta} points** stronger would have played something else, and Stockfish rates their move at least **{threshold} cp** better. | |
| B13 | Maia was trained on Lichess ratings, which run higher than Chess.com's; consider a bigger gap. *(appended to B12 on the Chess.com tab)* | |
| B14 | More settings *(expander)* | |
| B15 | Stockfish depth *(label)* | |
| B16 | Skip moves before move # *(label)* | |
| B17 | Skip bullet games *(checkbox)* | |
| B18 | Find my errors *(main button)* | |

### While it runs

| # | Current | Yours |
|---|---|---|
| R1 | Fetching games… | |
| R2 | {n} games so far | |
| R3 | Loading Maia and Stockfish… | |
| R4 | Maia model (one-time download, MB) *(progress bar label)* | |
| R5 | Analyzing… | |
| R6 | Games analyzed *(progress bar label; a game counts once Maia and its Stockfish checks are both done)* | |
| R6b | This game: Maia *(smaller bar under R6: the game's moves through Maia)* | |
| R6c | This game: Stockfish checks *(smaller bar under R6: that game's checks)* | |
| R6d | after Maia *(in place of R6c's count until Maia has finished the game)* | |
| R8 | **{n}** cards found | |
| R9 | Saving deck… | |
| R10 | Cancel *(button, before analysis starts)* | |
| R11 | Stop and keep cards so far *(button, during analysis)* | |
| R12 | Maia is running on your GPU. | |
| R13 | Maia is running on your CPU (this browser has no usable WebGPU), so this will take a while. | |
| R13b | Phones run Maia on the CPU, so this will take a while. A computer will be much faster. | |

### Problems while building

| # | Current | Yours |
|---|---|---|
| E1 | Enter a username. | |
| E3 | No Lichess player named "{username}". | |
| E4 | No Chess.com player named "{username}". | |
| E5 | Lichess is rate-limiting requests. Wait a minute and try again. | |
| E6 | Lichess returned {status}. / Chess.com returned {status}. | |
| E7 | No games found to analyze. | |
| E8 | No errors found at these settings. Try a larger rating gap or a smaller threshold. | |
| E9 | Stopped before any cards were found. | |
| E11 | {n} game(s) had no rating for you and were skipped. | |
| E12 | Something went wrong. | |
| E13 | Too many decks saved from this address. Try again later. | |
| E14 | Could not save the deck right now. | |

## Deck page

| # | Current | Yours |
|---|---|---|
| D1 | Deck *(panel title)* | |
| D2 | New deck *(link, top right)* | |
| D3 | {n} cards | |
| D4 | {username} on {Lichess/Chess.com} · +{delta} rating · ≥{threshold} cp · depth {depth} | |
| D5 | From {games} games and {positions} of your moves. A stronger player chose differently {disagreements} times, and {cards} of those were worth at least {threshold} cp. | |
| D6 | Start drilling *(button)* | |
| D7 | ☆ Favorite / ★ Favorited *(button, in the browser that built the deck)* | |
| D8 | ★ Favorite *(badge, anywhere else)* | |
| D9 | Copy link / Copied *(button)* | |
| D10 | Unfavorited decks are kept for 30 days. Favorite it to keep it and add it to the favorites list on the Maia Drills page, where anyone can open it. | |
| D11 | Loading… | |
| D12 | That deck has expired or never existed. | |
| D13 | Build a new deck *(link under D12)* | |
| D14 | Only the browser that built this deck can change it. | |

### Adding new games (deck page, only in the browser that built it)

| # | Current | Yours |
|---|---|---|
| A1 | Newest game analyzed: {date} | |
| A2 | Add new games *(button)* | |
| A3 | No new games since {date}. | |
| A4 | Added {n} card(s) from {n} new game(s). | |
| A5 | {n} new game(s), but no new errors at these settings. | |
| A6 | {n} game(s) had no rating for you and were skipped. *(appended to A4/A5)* | |
| A7 | Stopped before any new cards were found. | |

The progress panel while adding is the same as when building (R1–R13).

## Favorite decks (bottom of the build page, the same list for everyone)

| # | Current | Yours |
|---|---|---|
| F1 | Favorite decks *(panel title)* | |
| F4 | No favorite decks yet. | |
| F5 | ★ {username} · {n} cards *(each row, first line)* | |
| F5b | {Lichess/Chess.com} · +{delta} rating · ≥{threshold} cp · depth {depth} · {games} games · {date} *(each row, second line)* | |
| F6 | Open → *(each row)* | |

## Drilling

| # | Current | Yours |
|---|---|---|
| T1 | ← Deck *(back link)* | |
| T2 | {correct}/{attempted} this session · {n}/{total} last answered right | |
| T3 | {White/Black} to play · move {n}. *(card header; "…" instead of "." for Black)* | |
| T4 | What would a {targetElo} play? (You were {userElo}, vs {opponent} {oppElo}) | |
| T5 | Make a move on the board. | |
| T5b | Not that one. One more try. *(after a first miss; deliberately no hint)* | |
| T6 | Show answer *(button)* | |
| T7 | Checking your move with Stockfish… | |
| T8 | Correct — that's the stronger move. | |
| T9 | Not the same move, but Stockfish rates it just as well. Counts. | |
| T8b | Got it on the second try. | |
| T9b | Not the same move, but Stockfish rates it just as well. Got it on the second try. | |
| T10 | Not quite. *(after the second miss)* | |
| T11 | Here's the answer. *(after Show answer)* | |
| T12 | A {targetElo} plays **{move}** (Maia {pct}%, eval {eval}) *(green key)* | |
| T13 | In the game you played **{move}** (eval {eval}) *(red key)* | |
| T14 | You tried **{move}** (eval {eval}) *(blue or yellow key; one line per move tried)* | |
| T15 | Open the game ↗ | |
| T16 | Next card → | |
| T17 | winning / losing *(shown instead of an eval past ±10)* | |

## Errors you can skip

These only show up if someone calls the API by hand or something is badly broken: "Body must be valid JSON.", "Method not allowed", "Missing or malformed id.", "Malformed id.", "Malformed source or username.", "Pass either id, or source and username.", "\"favorite\" must be true or false.", "Deck is too large.", "Unknown game source.", "Username must be 1–40 letters, digits, or _ . -", "Settings are out of range.", "Malformed stats.", "A deck needs at least one card.", "A deck holds at most 400 cards.", "A card is malformed.", "Duplicate card id.", "Too many requests. Try again later.", "Could not load decks right now.", "Could not update the deck right now."
