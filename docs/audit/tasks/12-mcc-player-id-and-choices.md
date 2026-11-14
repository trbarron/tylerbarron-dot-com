# 12 — Multiple Choice Chess: take the secret out of the URL

|            |                                                                |
| ---------- | -------------------------------------------------------------- |
| Finding    | S1 (remainder)                                                 |
| Needs      | Repo only                                                      |
| Risk       | Medium. Changes a public URL shape and the game's client flow. |
| Size       | Half a day                                                     |
| Depends on | Nothing                                                        |

## Why

PR #128 stopped the `state` endpoint from returning player ids and made joins and moves atomic. The remaining task is ordinary invite-link privacy.

**The player's secret is in the page URL**: `/multiple-choice-chess/:gameId/:playerId`. It is sent to Google Analytics (`app/root.tsx` sends `window.location.href` on every navigation), sits in browser history, and leaks whenever someone shares their screen or pastes the link to invite a friend. Whoever has it can move and resign as that player.

Client engine choices and scores remain unverified by design for this casual game. Do not add server-side choice storage or anti-reroll logic as part of this task.

## Secret out of the URL

Target: the game URL is `/multiple-choice-chess/:gameId`, safe to share as an invite. The secret lives in `sessionStorage` under a key that includes the game id.

- Lobby (`app/routes/multipleChoiceChess._index.tsx`): after `create` or `join`, store `player_id` in `sessionStorage` (`mcc:player:<gameId>`), then navigate to `/multiple-choice-chess/<gameId>`.
- Game page (`app/routes/multipleChoiceChess.$gameId.$playerId.tsx`, rename to `…$gameId.tsx`): read the id from `sessionStorage` in an effect (it does not exist during server rendering). No stored id means a spectator, or someone opening an invite link: offer "Join this game" when the game is still waiting, otherwise show the board read-only.
- Hook (`app/hooks/useMultipleChoiceChessGame.ts`): takes `playerId: string | null`. All API calls already send it in the body or query; that does not change.
- Routes (`app/routes.ts`): add the new route. Keep the old two-segment path as a route that stores the id from the URL into `sessionStorage` and replaces the location with the new URL, so links people already have keep working. Use `history.replaceState`/`navigate(..., { replace: true })` so the secret does not stay in history.
- The same pattern exists in Collaborative Checkmate (`/collaborative-checkmate/:gameId/:playerId`), but there the "player id" is a chosen username, not a secret. Leave it alone.

Use `sessionStorage` to keep seats separate across independent tabs. Browsers may copy session storage when duplicating a tab; do not treat this as a security boundary.

## Tests

- Cover storing the player id after create/join and migrating old links to the clean URL.
- Verify an invite without a stored player id offers joining or spectating without granting control of an occupied seat.
- Manually create, share, join and refresh in separate browsers; confirm generated links contain no player id.
- Check the legacy URL migration does not send the secret to analytics before replacing the URL; exclude that migration route from page-view tracking if necessary.

## Verify

`npm run lint && npm run typecheck && npm run format:check && npm test`, plus `npm run build && npm run build:arc:server && npm run build:arc:deps && npm run check:lambda-deps`. This changes what a page looks like for invited players, so follow the screenshots rule in `CLAUDE.md`. Commits: `fix(multiple-choice-chess): …`. One focused PR.

## Done when

No URL the app produces contains a player id, old links still work, analytics does not receive player ids, and joining, spectating and refreshing still work.
