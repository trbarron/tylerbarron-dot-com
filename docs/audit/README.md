# Audit — November 2026

A structural, security and performance audit of this hobby site, and the practical work worth keeping. The goal is to keep games fun, publishing easy and hosting inexpensive—not to build a production security program.

- **`findings.md`** is the audit itself: what was found, why it matters, and how each finding was checked. Read it for the reasoning.
- **`tasks/`** holds one brief per piece of remaining work. Each brief is written to be handed to someone, or to a model, with no other context than this folder and the repository.
- **The table below** is the single place that says what is done and what is not. Update it in the same PR as the work.

## Handing out a task

Give the executor one brief and this README. A brief states what it needs (repository only, AWS credentials, another repository), what it depends on, how risky it is, how to verify the result, and when to stop and ask.

A task marked "AWS" needs a session that can reach AWS. The original audit could not inspect AWS; subsequent inspection and changes are recorded below and in `../deployment.md`. Treat every remaining brief’s read-only inspection step as mandatory.

## Ground rules for whoever executes a task

1. **Read the whole brief before running anything**, then do the steps in order. Inspect first; change second; verify third.
2. **If what you see does not match what the brief expects, stop and report.** Do not improvise around a mismatch. The briefs say "stop and ask if" for the cases that were foreseen; the rule also covers the ones that were not.
3. **Never print or commit a secret.** `npx arc env` prints stored values, including the Redis URL with its password: do not print its raw output on a shared screen. The repository is public.
4. **Before changing an AWS resource, save its current configuration to a file.** Change one thing at a time. Keep the file until the change has been verified; it is the rollback.
5. **Irreversible actions need the owner's explicit yes, each time**: deleting a function, a role, a bucket object or an access key; anything in task 03. A brief saying "delete" is not that yes.
6. **Merging to `master` deploys the site.** Open a PR and let the owner merge unless they have told you to merge.
7. **Follow `CLAUDE.md`.** In particular: commits are Conventional Commits with an enforced scope (`commitlint.config.js`), the type decides whether a release is cut, and anything a server-rendered module imports must be in `server/package.json` or `ssr.noExternal`.
8. **Run the checks before pushing:**

   ```bash
   npm run lint && npm run typecheck && npm run format:check && npm test
   # for anything that touches a route, a server-rendered component, or the build:
   npm run build:arc && npm run check:lambda-deps
   ```

   Some tests need a real Redis and skip without one: `TEST_REDIS_URL=redis://localhost:6379 npm test`.

9. **Say what you verified and what you did not.** "Deployed, not tested" is a useful report. "Done" without a check is not.
10. **Record the outcome**: update the status table here, and for AWS changes add the resulting resource names and ids to `docs/deployment.md` so the next person can find them.

## What is known about the environment

From the repository. Items marked _unverified_ are inferred and should be confirmed by the first task that depends on them.

| Fact                    | Value                                                                                                          | Source                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Site                    | `https://tylerbarron.com`                                                                                      |                                              |
| Region                  | `us-west-2`                                                                                                    | `app.arc`                                    |
| Architect app name      | `tb-website-remix`                                                                                             | `app.arc`                                    |
| CloudFormation stack    | `TbWebsiteRemixProduction` _(unverified)_                                                                      | Architect's naming convention                |
| Lambda                  | One function for `/*`, `nodejs24.x`, 2048 MB, 30 s timeout, x86_64                                             | `app.arc`                                    |
| CloudFront distribution | `E1TUWNZL0WZZ6J`                                                                                               | `docs/deployment.md`                         |
| CloudFront behaviors    | `/assets/*`, `/fonts/*`, `/images/*` go to the asset bucket; everything else to API Gateway                    | AWS inspection, 12 Nov; `docs/deployment.md` |
| Asset bucket            | `remix-website-writing-posts`                                                                                  | CloudFront origin inspected 12 Nov           |
| Redis                   | URL in the stored environment variable `REDIS_TLS_URL` (production)                                            | `app.arc`, `app/utils/redis.server.ts`       |
| Deploy                  | GitHub Actions, `.github/workflows/deploy.yml`, on push to `master`; long-lived AWS keys in repository secrets |                                              |
| Camel Up Cup            | Submissions queued in Redis and emailed through SNS; old execution infrastructure retired 13 Nov               | `docs/deployment.md`                         |

## Status

Last updated 13 November 2026.

### Done

| Finding         | What was done                                                                                                                                                                                                                                                                                                                                            | Where                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| D1; task 10     | Assets survive deploys; master runs are not cancelled. Release 5.62.1 tagged only after deploy/bot checks; unchanged-version path verified in workflow-dispatch run 43294486638.                                                                                                                                                                         | PR #128, PR #136; deploy runs 43265605861 and 43294486638                |
| D2              | The Lambda's dependencies are installed at the root lockfile's versions                                                                                                                                                                                                                                                                                  | PR #128                                                                  |
| D3; task 28     | React Router advisory cleared; dependencies updated; original Dependabot PRs #129–#133 all closed. New grouped updates such as #135 remain routine dependency maintenance.                                                                                                                                                                               | PR #128, PR #134; GitHub verified 12 Nov                                 |
| S1 (most)       | Multiple Choice Chess no longer returns player ids; atomic join and move; ids from `crypto`                                                                                                                                                                                                                                                              | PR #128                                                                  |
| S2 (code side)  | One `clientIp()` that prefers a CloudFront-supplied header                                                                                                                                                                                                                                                                                               | PR #128                                                                  |
| S3; task 01     | Redis TLS verification on by default; timeouts; no client thrash. Production health and bot checks passed 12 Nov; no opt-out added. Production TLS settings not independently inspected.                                                                                                                                                                 | PR #128; `docs/deployment.md`                                            |
| S5              | Healthcheck no longer fetches a URL built from request headers                                                                                                                                                                                                                                                                                           | PR #128                                                                  |
| S6.1            | `'unsafe-eval'` only on the Maia page; `'wasm-unsafe-eval'` elsewhere                                                                                                                                                                                                                                                                                    | PR #128                                                                  |
| S7; tasks 02–03 | Submission email confirmed end to end; old camel-up-tournament function, its dedicated role/policy, site invoke policy and legacy setting removed with owner approval. Former role could read/write only camel-up/* and images/camel-up/*, with prefix-scoped listing, logging and self-invocation. Leaderboard retained; no resources shared that role. | AWS verified 13 Nov; `docs/deployment.md`; `infra/iam/camel-notify.json` |
| P1; task 05     | Static page headers and origin-controlled CloudFront caching applied and verified. Existing short 404 error cache remains. Invalidation and pruning both succeeded in deploy run 43265605861 (task 04 complete).                                                                                                                                         | PR #128; `docs/deployment.md`; `infra/cloudfront/honour-origin.json`     |
| S4; task 11     | Per-address writer limits, current/yesterday score dates and atomic completion counts deployed in 5.62.1. Task 06 still needed for trustworthy client addresses.                                                                                                                                                                                         | PR #136; deploy run 43265605861                                          |
| A5; task 08     | Four runtime/uptime alarms configured and healthy; both regional subscriptions confirmed. Each alarm successfully published its test notification, the owner received all four emails, and normal evaluation restored OK. Post-deploy bot checks are also verified.                                                                                      | AWS and owner verified 13 Nov; `infra/monitoring/`; `docs/deployment.md` |
| A1              | Blog posts are ordinary modules, one chunk each, with a build-time index                                                                                                                                                                                                                                                                                 | PR #128                                                                  |
| —               | `/the-riddler` hydration mismatch fixed                                                                                                                                                                                                                                                                                                                  | PR #128                                                                  |

### Remaining work

These are useful improvements, not release blockers. Prefer making games and posts over completing an audit checklist. Task numbers stay stable; Git history retains removed briefs.

| #                                             | Task                                     | Why keep it                                                                                                         | Priority             |
| --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------- |
| [13](tasks/13-single-image-tree.md)           | Deploy all images through CI             | Prevents committed images from silently missing in production; removes a manual publishing step.                    | Implemented; deploy verification pending |
| [12](tasks/12-mcc-player-id-and-choices.md)   | Remove chess player secrets from URLs    | Ordinary link sharing and analytics should not expose a player's seat. No anti-cheating system.                     | Soon                 |
| [09](tasks/09-deploy-oidc.md)                 | Replace long-lived deploy keys with OIDC | Protects the AWS account and its bill, rather than toy game scores. Current deploy works; schedule when convenient. | Soon                 |
| [07](tasks/07-cost-guardrails.md)             | Check budget-alert delivery              | Existing throttle and USD 5 budget are enough for now; confirm the budget can reach the owner.                      | Small follow-up      |
| [14](tasks/14-arc-static-duplicate-upload.md) | Check for duplicate image uploads        | Worth a short inspection alongside 13; change only if the waste is meaningful.                                      | With 13              |
| [20](tasks/20-images-and-dead-code.md)        | Lazy-load below-the-fold images          | Small improvement for long posts; no image-conversion pipeline.                                                     | When touching images |

### Deliberately out of scope

Removed from the active audit on 13 November 2026 to fit a personal site with casual games, no accounts and no sensitive user data. These are accepted tradeoffs, not completed fixes:

- **15 — Additional edge security headers:** no new all-response CloudFront header policy. Existing TLS, page CSP and input validation stay in place. Task 06 was independently merged as PR #141 while this cleanup was in progress; retain its working code and [short rollout verification checklist](tasks/06-trustworthy-client-ip.md), without expanding it into further hardening work.
- **07 — Extra concurrency tuning:** the API already throttles at 50 requests/second with burst 100. No new Lambda cap; observed concurrency reached 56. A budget alert is a notification, not a spending cap.
- **12, part 2 — Stored chess choices:** no server-side anti-reroll mechanism. Scores and client engine choices remain unverified; casual cheating is an accepted limitation.
- **16 — Self-hosting engine runtimes:** keep the working CDN setup unless reliability becomes a problem.
- **17, 18 and 21 — Broad refactors and housekeeping:** no project registry, generic API-helper framework, visual-test overhaul or audit-driven cleanup. Fix concrete bugs and simplify code when touching it.
- **19 — Polling optimization:** no version-response protocol or lobby rewrite without measured cost or latency trouble.
- **20 — Image conversion pipeline:** current image sizes do not justify it. Keep simple lazy loading only.
- **22–25 — Major dependency/runtime and architecture migrations:** no upgrades merely to complete this audit. Continue routine dependency maintenance and address actual advisories or support deadlines when relevant.
- **26 — Infrastructure as code:** operational notes and saved rollback configs are sufficient at this scale.
- **27 — Local Camel Up tournament runner:** a separate hobby feature to build if wanted, not an audit obligation. The website no longer executes submitted code.

Runtime alarms and post-deploy checks are already complete, as are release ordering, writer limits, caching and retirement of the old tournament execution infrastructure. Keep those working without expanding their scope.

### Corrections made to the audit after it was written

Two things in `findings.md` turned out wrong when the work was done. They are noted at the top of that file and repeated here because an executor might otherwise act on the original text:

- **Do not use an S3 lifecycle rule to prune old build assets.** A file whose content did not change keeps its old upload date, so a month without deploys would expire the live site's assets. The deploy prunes with `scripts/prune-old-assets.mjs` instead.
- **`'unsafe-eval'` cannot be removed from the Maia page.** onnxruntime-web's WebGPU build uses `new Function`.
