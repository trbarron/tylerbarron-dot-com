# 21 — Housekeeping: entry files, tests, duplicated docs

|            |              |
| ---------- | ------------ |
| Finding    | A4, A6       |
| Needs      | Repo only    |
| Risk       | Low          |
| Size       | Half a day. Each item is independent; do them as separate small PRs. |
| Depends on | Nothing      |

## Items

**1. `app/entry.server.tsx`**

- `handleBotRequest` and `handleBrowserRequest` are the same function except for one callback name (`onAllReady` for bots, `onShellReady` for browsers). Merge them into one function that takes the callback name.
- `setTimeout(abort, ABORT_DELAY)` is never cleared. Clear it when the response stream finishes.
- Remove the Remix template comments at the top.
- This file is on the path of every page. After changing it, run the Lambda check and the manual bot check from the `verify-lambda-deps` skill (`.claude/skills/verify-lambda-deps/SKILL.md`): a mistake here shows only for bots.

**2. `server.ts`**

- The "WORKAROUND" comments describe a problem the code no longer works around. Remove or correct them.
- The static-file fallback (`ARC_ENV !== 'production'`) is sandbox-only. Leave the behaviour; just make the production path easy to read.

**3. Visual tests**

`tests/visual/` has Playwright snapshot tests whose baselines are `*-chromium-darwin.png`. They are not in CI and only pass on a Mac. `npm run pr-screenshots` (see `docs/pr-screenshots.md`) now covers the same need for PRs. Ask the owner which they want:

- delete `tests/visual/`, `playwright.config.ts`'s snapshot setup and the three `test:visual*` scripts, or
- run them in CI on Linux with Linux baselines (regenerate inside the Playwright Docker image so fonts match).

Do not delete without asking.

**5. Three copies of the agent guidance**

`AGENT.md`, `AGENTS.md` and `CLAUDE.md` are identical 24-line files. Either replace two with symlinks to the third (check that Git and the tools that read them follow symlinks on the owner's machines), or add a check to CI that the three are byte-identical. The CI check is the safer choice; a dependency-free script in `scripts/` and a step in the `design` job is enough.

**6. Stale numbers in `docs/deployment.md`**

Sizes and version floors quoted there drift. Where a number is not load-bearing, replace it with a description; where it is (the 6 MB response cap), leave it.

## Verify

For every item: `npm run lint && npm run typecheck && npm run format:check && npm test`. For items 1 and 2 also `npm run build:arc && npm run check:lambda-deps`, and request `/`, a blog post and a chess page from the built server with a bot user agent.

Commit types: `refactor: …` (items 1, 2), `test: …` (3, 4), `ci: …` or `docs: …` (5, 6). None of these releases.

## Done when

Each item is either merged or recorded in the status table as declined by the owner.
