# Audit — November 2026

A structural, security and performance audit of this site, and the work that came out of it.

- **`findings.md`** is the audit itself: what was found, why it matters, and how each finding was checked. Read it for the reasoning.
- **`tasks/`** holds one brief per piece of remaining work. Each brief is written to be handed to someone, or to a model, with no other context than this folder and the repository.
- **The table below** is the single place that says what is done and what is not. Update it in the same PR as the work.

## Handing out a task

Give the executor one brief and this README. A brief states what it needs (repository only, AWS credentials, another repository), what it depends on, how risky it is, how to verify the result, and when to stop and ask.

A task marked "AWS" needs a session that can actually reach AWS: the audit was written from a sandbox with no working AWS credentials and no route to the live site, so **nothing in any AWS-side brief has been run**. The commands are written from the documentation and from what the repository says about the account. Treat the read-only inspection step at the top of each brief as mandatory, not as a formality.

## Ground rules for whoever executes a task

1. **Read the whole brief before running anything**, then do the steps in order. Inspect first; change second; verify third.
2. **If what you see does not match what the brief expects, stop and report.** Do not improvise around a mismatch. The briefs say "stop and ask if" for the cases that were foreseen; the rule also covers the ones that were not.
3. **Never print or commit a secret.** `npx arc env` prints stored values, including the Redis URL with its password: pipe it through the `sed` shown in task 01 or do not run it on a shared screen. The repository is public.
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
| CloudFront behaviors | `/assets/*`, `/fonts/*`, `/images/*` go to the asset bucket; everything else to API Gateway | `docs/deployment.md` _(unverified)_ |
| Asset bucket | Repository secret `AWS_BUCKET_NAME`; probably `remix-website-writing-posts` _(unverified)_ | default in the old upload script |
| Redis | URL in the stored environment variable `REDIS_TLS_URL` (production) | `app.arc`, `app/utils/redis.server.ts` |
| Deploy | GitHub Actions, `.github/workflows/deploy.yml`, on push to `master`; long-lived AWS keys in repository secrets | |
| Tournament Lambda | `camel-up-tournament`, deployed from the separate repository `trbarron/Camel_Up_Cup_2K18`; no longer invoked by the site | |

## Status

Last updated 12 November 2026.

### Done

| Finding | What was done | Where |
| --- | --- | --- |
| D1 | Deploy keeps the previous build's assets and prunes by age afterwards; `master` runs are never cancelled | PR #128 |
| D2 | The Lambda's dependencies are installed at the root lockfile's versions | PR #128 |
| D3 | React Router advisory cleared; Dependabot watches npm; all dependencies updated | PR #128, PR #134 |
| S1 (most) | Multiple Choice Chess no longer returns player ids; atomic join and move; ids from `crypto` | PR #128 |
| S2 (code side) | One `clientIp()` that prefers a CloudFront-supplied header | PR #128 |
| S3 | Redis TLS verification on; timeouts; no client thrash | PR #128 |
| S5 | Healthcheck no longer fetches a URL built from request headers | PR #128 |
| S6.1 | `'unsafe-eval'` only on the Maia page; `'wasm-unsafe-eval'` elsewhere | PR #128 |
| S7 (site side) | The site no longer invokes the tournament Lambda; submissions are queued and emailed | PR #128 |
| P1 (code side) | Static pages send edge-cache headers; the deploy invalidates | PR #128 |
| A1 | Blog posts are ordinary modules, one chunk each, with a build-time index | PR #128 |
| — | `/the-riddler` hydration mismatch fixed | PR #128 |

### Open

Ordered by when to do them. "Needs" says what access the executor must have.

| # | Task | Finding | Needs | Risk | Depends on | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [01](tasks/01-production-health-and-redis-tls.md) | Confirm production is healthy after the Redis TLS change | S3 | Internet; AWS if a fix is needed | Low | — | **Not started. Do first.** |
| [02](tasks/02-camel-up-cup-email.md) | Set up the Camel Up Cup submission email | S7 | AWS | Low | 01 | Not started |
| [28](tasks/28-dependabot-prs.md) | Clear the first batch of Dependabot PRs | D3 | GitHub | Low | PR #134 | Not started |
| [04](tasks/04-deploy-invalidation-permission.md) | Let the deploy invalidate CloudFront | P1 | AWS | Low | — | Not started |
| [05](tasks/05-cloudfront-page-caching.md) | Make CloudFront honour the pages' cache headers | P1 | AWS | Medium–high | 01, 04 | Not started |
| [07](tasks/07-cost-guardrails.md) | Bound the worst-case AWS bill | S8 | AWS | Low–medium | — | Not started |
| [08](tasks/08-alarms-and-post-deploy-check.md) | Alarms, and a check after every deploy | A5 | AWS + repo | Low | 01 | Not started |
| [11](tasks/11-rate-limit-writers.md) | Rate-limit the remaining endpoints that write to Redis | S4 | Repo | Low | — | Not started |
| [06](tasks/06-trustworthy-client-ip.md) | Give the rate limiter an address the client can't forge | S2 | AWS + repo | Medium | 05 | Not started |
| [03](tasks/03-retire-tournament-lambda.md) | Retire the old tournament Lambda | S7 | AWS | Irreversible | 02 | Not started |
| [10](tasks/10-release-after-build.md) | Tag a release only after the build exists | D1 | Repo | Medium | — | Not started |
| [09](tasks/09-deploy-oidc.md) | Replace the deploy's long-lived AWS keys with OIDC | D4 | AWS + repo | Medium | 04 | Not started |
| [13](tasks/13-single-image-tree.md) | One image tree, deployed by CI | D7, D8 | Repo; AWS read | Medium | — | Not started |
| [14](tasks/14-arc-static-duplicate-upload.md) | Find out whether every deploy uploads the images twice | D6 | AWS read; repo | Low to check | — | Not started |
| [12](tasks/12-mcc-player-id-and-choices.md) | Multiple Choice Chess: secret out of the URL, verify choices | S1 | Repo | Medium | — | Not started |
| [15](tasks/15-security-headers-policy.md) | Send the security headers on every response | S6.4 | AWS | Low–medium | 05, 06 | Not started |
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

### Suggested grouping

- **One AWS session, about half a day, low risk:** 01, 02, 04, 07, and the read-only parts of 03, 13 and 14.
- **One careful AWS session on the CloudFront distribution:** 05, then 06, then 15. One executor, one change at a time, with the saved config for rollback. Do not run these in parallel with each other or with 26.
- **Repository-only, independent of each other:** 10, 11, 12, 16, 17, 19, 20, 21. Any of these can be handed out today.
- **After alarms exist (08):** 22, 23, 24.

### Corrections made to the audit after it was written

Two things in `findings.md` turned out wrong when the work was done. They are noted at the top of that file and repeated here because an executor might otherwise act on the original text:

- **Do not use an S3 lifecycle rule to prune old build assets.** A file whose content did not change keeps its old upload date, so a month without deploys would expire the live site's assets. The deploy prunes with `scripts/prune-old-assets.mjs` instead.
- **`'unsafe-eval'` cannot be removed from the Maia page.** onnxruntime-web's WebGPU build uses `new Function`.
