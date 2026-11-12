# 28 — Clear the first batch of Dependabot PRs

|            |                          |
| ---------- | ------------------------ |
| Finding    | D3 (follow-up)           |
| Needs      | GitHub access            |
| Risk       | Low                      |
| Size       | 15 minutes               |
| Depends on | PR #134 merged           |

## Why

PR #128 turned Dependabot on for npm. It immediately opened five PRs. PR #134 then updated every dependency by hand and added ignore rules for the major versions that cannot be taken yet. The five PRs are now either superseded or unwanted.

| PR | What it proposes | What to do |
| --- | --- | --- |
| #129 | React Router group (major, to 8) | Close. The AWS adapter requires version 7. |
| #130 | 27 minor and patch updates | Should close itself or shrink once #134 is on `master`. If it remains with a handful of updates newer than a week ago, let CI run and merge it if green. |
| #131 | ESLint 9 → 10 | Close. Three lint plugins do not support 10. |
| #132 | `@types/node` 24 → 26 | Close. It follows the Lambda runtime; see task 25. |
| #133 | `@eslint/js` 9 → 10 | Close. Same as #131. |

## Steps

1. Confirm #134 is merged.
2. Close #129, #131, #132 and #133 with a one-line comment giving the reason from the table. Closing a Dependabot PR tells it not to propose that version again; the ignore rules in `.github/dependabot.yml` cover later versions of the same major.
3. For #130, comment `@dependabot rebase` and wait for it to update. Then decide as in the table.

Also note: the Dependabot **npm** run on 12 November 2026 was cancelled after 55 minutes (Actions run 43222770002). If the next weekly run also fails to finish, look at its log before assuming Dependabot is working.

## Going forward

Dependabot is configured weekly, with React Router grouped and minor and patch updates grouped (`.github/dependabot.yml`). Its PRs run the full CI. A grouped minor-and-patch PR that is green is safe to merge; merging to `master` deploys.

## Done when

No Dependabot PR older than a week is open without a decision.
