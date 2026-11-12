# 10 — Verify a non-release deployment preserves the version

PR #136 deployed successfully as `5.62.1` in [run 43265605861](https://github.com/trbarron/tylerbarron-dot-com/actions/runs/43265605861).
The build and bot checks finished before tag creation; `package.json` and the live
footer agreed, and the automated release commit retained `[skip ci]`. Failure ordering
and the no-release planner result have regression tests. Operating details are in
`docs/deployment.md` ("Versioning").

One production observation remains: after a deployment containing only `test:`,
`docs:` or other non-release changes, confirm the version is unchanged, no new tag is
created, and the live bot checks pass with the new source commit. The current follow-up
PR is suitable for this check. Then update the audit status table and remove this brief.
