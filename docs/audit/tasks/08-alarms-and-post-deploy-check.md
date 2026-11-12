# 08 — Alarms, and a check after every deploy

|            |                                      |
| ---------- | ------------------------------------ |
| Finding    | A5                                   |
| Needs      | AWS credentials (CloudWatch, SNS) for part A; repo only for part B |
| Risk       | Low                                  |
| Size       | 2 hours                              |
| Depends on | 01                                   |

## Why

Errors go to `console.error` and nowhere else. In June 2026 some routes returned 500 to bots and curl only; browsers recovered client-side, so nobody saw it (`docs/deployment.md`, "Lambda dependencies"). Nothing today would notice a repeat, or notice Redis going away.

## Part A — Alarms (AWS)

1. Create one SNS topic for operational alerts and subscribe the owner's email (ask for the address; it must not go in the repo). Do not reuse the Camel Up Cup topic from task 02.

2. Create three alarms that notify that topic. Names and thresholds:

   | Alarm | Metric | Condition |
   | --- | --- | --- |
   | `site-lambda-errors` | `AWS/Lambda` `Errors`, site function | Sum ≥ 5 in 5 minutes |
   | `site-5xx` | `AWS/ApiGateway` `5xx` for the site API (HTTP API metric name: `5xx`, dimension `ApiId`) | Sum ≥ 10 in 5 minutes |
   | `site-lambda-throttles` | `AWS/Lambda` `Throttles`, site function | Sum ≥ 1 in 5 minutes |

   Use `aws cloudwatch put-metric-alarm` with `--treat-missing-data notBreaching`, so a quiet night is not an alarm.

3. Add an uptime check on the healthcheck, which fails when Redis is unreachable. Either a Route 53 health check on `https://tylerbarron.com/healthcheck` (string match `OK`) with an alarm in `us-east-1`, or a CloudWatch Synthetics canary. The Route 53 check is cheaper and enough.

## Part B — Post-deploy check: deployed and verified

[PR #136](https://github.com/trbarron/tylerbarron-dot-com/pull/136) adds
`scripts/check-live-site.mjs` to the deploy workflow. It checks the homepage, a blog
post, the chess lobby, pizza map and Redis healthcheck as Googlebot, with retries,
a deployment query key and footer version/commit verification. It fails the job
before release tagging if the deployment is broken.

Verified in production deploy run `43265605861` on 12 November 2026; independent
live bot checks also passed with the expected version and source commit. Do not
reimplement it. Runtime alerting in Part A remains open. Operating instructions
are in `docs/deployment.md` ("Running the live check manually").

## Verify

- Part A: set each alarm to `ALARM` once with `aws cloudwatch set-alarm-state` and confirm the email arrives; it returns to `OK` on its own.
- Part B: the step passes on a real deploy. To prove it can fail, run the script locally against a URL that returns 404.

## Done when

A deploy that produces a broken site turns the workflow red, and a runtime failure sends an email within about five minutes.
