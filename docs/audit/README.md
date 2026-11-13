# Audit — November 2026

A structural, security and performance audit of this site, and the work that came out of it.

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

| Fact | Value | Source |
| --- | --- | --- |
| Site | `https://tylerbarron.com` | |
| Region | `us-west-2` | `app.arc` |
| Architect app name | `tb-website-remix` | `app.arc` |
| CloudFormation stack | `TbWebsiteRemixProduction` _(unverified)_ | Architect's naming convention |
| Lambda | One function for `/*`, `nodejs24.x`, 2048 MB, 30 s timeout, x86_64 | `app.arc` |
| CloudFront distribution | `E1TUWNZL0WZZ6J` | `docs/deployment.md` |
| CloudFront behaviors | `/assets/*`, `/fonts/*`, `/images/*` go to the asset bucket; everything else to API Gateway | AWS inspection, 12 Nov; `docs/deployment.md` |
| Asset bucket | `remix-website-writing-posts` | CloudFront origin inspected 12 Nov |
| Redis | URL in the stored environment variable `REDIS_TLS_URL` (production) | `app.arc`, `app/utils/redis.server.ts` |
| Deploy | GitHub Actions, `.github/workflows/deploy.yml`, on push to `master`; long-lived AWS keys in repository secrets | |
| Camel Up Cup | Submissions queued in Redis and emailed through SNS; old execution infrastructure retired 13 Nov | `docs/deployment.md` |

## Status

Last updated 13 November 2026.

### Done

| Finding | What was done | Where |
| --- | --- | --- |
| D1; task 10 | Assets survive deploys; master runs are not cancelled. Release 5.62.1 tagged only after deploy/bot checks; unchanged-version path verified in workflow-dispatch run 43294486638. | PR #128, PR #136; deploy runs 43265605861 and 43294486638 |
| D2 | The Lambda's dependencies are installed at the root lockfile's versions | PR #128 |
| D3 | React Router advisory cleared; Dependabot watches npm; all dependencies updated | PR #128, PR #134 |
| S1 (most) | Multiple Choice Chess no longer returns player ids; atomic join and move; ids from `crypto` | PR #128 |
| S2 (code side) | One `clientIp()` that prefers a CloudFront-supplied header | PR #128 |
| S3; task 01 | Redis TLS verification on by default; timeouts; no client thrash. Production health and bot checks passed 12 Nov; no opt-out added. Production TLS settings not independently inspected. | PR #128; `docs/deployment.md` |
| S5 | Healthcheck no longer fetches a URL built from request headers | PR #128 |
| S6.1 | `'unsafe-eval'` only on the Maia page; `'wasm-unsafe-eval'` elsewhere | PR #128 |
| S7; tasks 02–03 | Submission email confirmed end to end; old camel-up-tournament function, its dedicated role/policy, site invoke policy and legacy setting removed with owner approval. Former role could read/write only camel-up/* and images/camel-up/*, with prefix-scoped listing, logging and self-invocation. Leaderboard retained; no resources shared that role. | AWS verified 13 Nov; `docs/deployment.md`; `infra/iam/camel-notify.json` |
| P1; task 05 | Static page headers and origin-controlled CloudFront caching applied and verified. Existing short 404 error cache remains. Invalidation permission verification is tracked in 04. | PR #128; `docs/deployment.md`; `infra/cloudfront/honour-origin.json` |
| A1 | Blog posts are ordinary modules, one chunk each, with a build-time index | PR #128 |
| — | `/the-riddler` hydration mismatch fixed | PR #128 |

### Open

Ordered by when to do them. "Needs" says what access the executor must have.

| # | Task | Finding | Needs | Risk | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [28](tasks/28-dependabot-prs.md) | Clear the first batch of Dependabot PRs | D3 | GitHub | Low | PR #134 | Not started |
| [04](tasks/04-deploy-invalidation-permission.md) | Let the deploy invalidate CloudFront | P1 | AWS | Low | — | Permission applied 12 Nov; IAM simulation allowed. Pruning already succeeded. Invalidation confirmation on next deploy pending. |
| [07](tasks/07-cost-guardrails.md) | Bound the worst-case AWS bill | S8 | AWS | Low–medium | — | Inspected 12 Nov: throttle 50/burst 100 and USD 5 budget already exist. Peak concurrency 56; proposed cap of 20 unsuitable. No cap changed; owner decision pending. |
| [08](tasks/08-alarms-and-post-deploy-check.md) | Alarms, and a check after every deploy | A5 | AWS + repo | Low | 01 | Bot checks verified; four runtime/uptime alarms configured with separate regional topics. External probes healthy. Recipient selection, confirmation and delivery testing remain. |
| [11](tasks/11-rate-limit-writers.md) | Rate-limit the remaining endpoints that write to Redis | S4 | Repo | Low | — | Implemented in PR #136; merge/deploy pending. Task 06 still needed for trustworthy addresses. |
| [06](tasks/06-trustworthy-client-ip.md) | Give the rate limiter an address the client can't forge | S2 | AWS + repo | Medium | 05 | Inspection complete: existing www redirect function; direct API returns 200. Paused for owner decision on extending the function. |
| [09](tasks/09-deploy-oidc.md) | Replace the deploy's long-lived AWS keys with OIDC | D4 | AWS + repo | Medium | 04 | Not started |
| [13](tasks/13-single-image-tree.md) | One image tree, deployed by CI | D7, D8 | Repo; AWS read | Medium | — | Not started |
| [14](tasks/14-arc-static-duplicate-upload.md) | Find out whether every deploy uploads the images twice | D6 | AWS read; repo | Low to check | — | Not started |
| [12](tasks/12-mcc-player-id-and-choices.md) | Multiple Choice Chess: secret out of the URL, verify choices | S1 | Repo | Medium | — | Not started |
| [15](tasks/15-security-headers-policy.md) | Send the security headers on every response | S6.4 | AWS | Low–medium | 05, 06 | Existing RemixAPIPolicy found; preserve its CORS configuration when preparing a change. No header policy changed. |
| [27](tasks/27-camel-tournament-runner.md) | A local tournament runner for Camel Up Cup | S7 | Other repo; Docker; AWS | Runs untrusted code | 02 | Not started |
| [16](tasks/16-self-host-engines.md) | Serve Stockfish and the ONNX runtime from the site itself | S6.2 | Repo | Medium | — | Not started |
| [18](tasks/18-shared-server-helpers.md) | Shared helpers for the older API routes | A3, P3 | Repo | Low–medium | 11 | Not started |
| [17](tasks/17-project-registry.md) | One registry for projects | A2 | Repo | Medium | — | Not started |
| [19](tasks/19-polling-efficiency.md) | Make polling cheaper | P2 | Repo | Low–medium | — | Not started |
| [20](tasks/20-images-and-dead-code.md) | Lazy images, modern formats, unused helpers | P4 | Repo | Low | 13 | Not started |
| [21](tasks/21-housekeeping.md) | Entry files, tests, duplicated docs | A4, A6 | Repo | Low | — | Not started |
| [22](tasks/22-ioredis-6.md) | Upgrade ioredis to 6 | Deps | Repo; real Redis | Medium–high | 01, 08 | Not started |
| [23](tasks/23-react-router-future-flags.md) | Opt into React Router's v8 behaviours | D3 | Repo | Medium | 08 | Not started |
| [24](tasks/24-lambda-arm64.md) | Run the Lambda on arm64 | D9 | Repo; a deploy | Low–medium | 08 | Not started |
| [25](tasks/25-node-26.md) | Move to Node 26 when Lambda supports it | — | Repo; a deploy | Medium | External | Blocked: `nodejs26.x` was in preview on 12 Nov 2026 |
| [26](tasks/26-infrastructure-as-code.md) | Put the hand-made AWS resources into code | D5 | AWS + repo | High if careless | 05–08, 15 | Not started |

### Next work

- Release ordering and the unchanged-version path are verified in production runs 43265605861 and 43294486638. Invalidation and pruning succeeded.
- Tasks 02–03 are complete: emails received, approved execution resources retired, leaderboard/email/health verified. Task 27 remains for the local runner.
- Handle 06, then 15, sequentially on CloudFront; both found existing resources that must be preserved.
- Keep 22–25 behind their observability/runtime prerequisites. Task 21’s visual-test deletion still needs the owner’s choice.

Completed task briefs are removed once their lasting operational details are in `docs/deployment.md`. Task numbers remain stable for dependencies; Git history retains the original briefs. Implemented tasks with verification outstanding keep a short checklist.

### Corrections made to the audit after it was written

Two things in `findings.md` turned out wrong when the work was done. They are noted at the top of that file and repeated here because an executor might otherwise act on the original text:

- **Do not use an S3 lifecycle rule to prune old build assets.** A file whose content did not change keeps its old upload date, so a month without deploys would expire the live site's assets. The deploy prunes with `scripts/prune-old-assets.mjs` instead.
- **`'unsafe-eval'` cannot be removed from the Maia page.** onnxruntime-web's WebGPU build uses `new Function`.
