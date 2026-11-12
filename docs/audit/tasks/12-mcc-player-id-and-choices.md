# 12 — Multiple Choice Chess: take the secret out of the URL, verify choices

|            |                         |
| ---------- | ----------------------- |
| Finding    | S1 (remainder)          |
| Needs      | Repo only               |
| Risk       | Medium. Changes a public URL shape and the game's client flow. |
| Size       | 1 day                   |
| Depends on | Nothing                 |

## Why

PR #128 stopped the `state` endpoint from returning player ids and made joins and moves atomic. Two weaknesses remain.

1. **The player's secret is in the page URL**: `/multiple-choice-chess/:gameId/:playerId`. It is sent to Google Analytics (`app/root.tsx` sends `window.location.href` on every navigation), sits in browser history, and leaks whenever someone shares their screen or pastes the link to invite a friend. Whoever has it can move and resign as that player.
2. **The server trusts the four choices the client sends with a move.** It checks the move is legal and is one of the choices, but the choices themselves come from the client, so a client can offer itself any legal move. The reported rank is also taken on trust; that part is documented as by design (`docs/multiple-choice-chess.md`) and is out of scope.

## Part 1 — Secret out of the URL

Target: the game URL is `/multiple-choice-chess/:gameId`, safe to share as an invite. The secret lives in `sessionStorage` under a key that includes the game id.

- Lobby (`app/routes/multipleChoiceChess._index.tsx`): after `create` or `join`, store `player_id` in `sessionStorage` (`mcc:player:<gameId>`), then navigate to `/multiple-choice-chess/<gameId>`.
- Game page (`app/routes/multipleChoiceChess.$gameId.$playerId.tsx`, rename to `…$gameId.tsx`): read the id from `sessionStorage` in an effect (it does not exist during server rendering). No stored id means a spectator, or someone opening an invite link: offer "Join this game" when the game is still waiting, otherwise show the board read-only.
- Hook (`app/hooks/useMultipleChoiceChessGame.ts`): takes `playerId: string | null`. All API calls already send it in the body or query; that does not change.
- Routes (`app/routes.ts`): add the new route. Keep the old two-segment path as a route that stores the id from the URL into `sessionStorage` and replaces the location with the new URL, so links people already have keep working. Use `history.replaceState`/`navigate(..., { replace: true })` so the secret does not stay in history.
- The same pattern exists in Collaborative Checkmate (`/collaborative-checkmate/:gameId/:playerId`), but there the "player id" is a chosen username, not a secret. Leave it alone.

Why `sessionStorage` and not `localStorage`: one tab, one seat. A second tab on the same game becomes a spectator, which is the safe default.

## Part 2 — Server-side choices

Make the server the source of the choices for the current position, without running an engine on the server:

- When a client's engine has produced its four candidates, it posts them: `POST /api/multipleChoiceChess/choices` with `{ game_id, player_id, fen, choices }`. The server accepts only from the player to move, only if `fen` matches the stored position, only if every choice is a legal move there, and only **once per position**: store them on the game hash as `pending_choices` with the fen they belong to, using a Lua script that refuses to overwrite (copy the style of `JOIN_SCRIPT` in `app/utils/multipleChoiceChess/gameState.server.ts`).
- `move` stops reading `choices` from the request and checks the move against `pending_choices` for the current fen; the move script clears them.
- The client offers only what the server stored (read back from the `choices` response), so a refresh or a second engine run cannot shop for better options.

This does not stop a modified client from posting four hand-picked legal moves as its first and only set. It does stop re-rolling, and it makes the stored history honest about what was offered. State that limit in `docs/multiple-choice-chess.md`.

## Tests

- `tests/api/multipleChoiceChessMove.test.ts` and `…State.test.ts` exist; extend them. Add a test file for the new `choices` endpoint.
- `tests/integration/multipleChoiceChessGame.test.ts` runs the Lua scripts against a real Redis (`TEST_REDIS_URL=redis://localhost:6379`). Add: two simultaneous `choices` posts for one position, exactly one is stored.
- Manually, in two browsers: create, share the URL, join from the second browser via the invite, play three moves each, refresh mid-turn (choices must not change), open the URL in a third browser (spectator).

## Verify

`npm run lint && npm run typecheck && npm run format:check && npm test`, plus `npm run build && npm run build:arc:server && npm run build:arc:deps && npm run check:lambda-deps`. This changes what a page looks like for invited players, so follow the screenshots rule in `CLAUDE.md`. Commits: `fix(multiple-choice-chess): …`. Do the two parts as separate PRs.

## Done when

No URL the app produces contains a player id, old links still work, and a refresh never changes the offered moves.
