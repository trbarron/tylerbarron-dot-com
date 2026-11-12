# 10 — Verify release ordering on the first deploy

[PR #136](https://github.com/trbarron/tylerbarron-dot-com/pull/136) implements this task.
`scripts/plan-release.mjs` computes the next version using semantic-release’s dry-run
API; Vite builds with `APP_VERSION`. The workflow builds, deploys and checks the live
site before tagging, then confirms `package.json` matches the deployed version.
The implementation and failure ordering have regression tests. The intended flow is
documented in `docs/deployment.md` ("Versioning").

## Remaining verification

After the PR merges, inspect its first production deployment:

- The build, production deploy and live bot checks succeed before semantic-release
  publishes a tag. A failure in any of those steps skips publishing.
- The footer’s version matches the released `package.json` version. Its commit hash
  identifies the source build, before the automated release commit.
- The release commit retains `[skip ci]`.
- A later deployment containing only non-release changes keeps the version unchanged.

Record the deployment evidence in the audit status table, then remove this brief.
No further release implementation is needed unless verification finds a problem.
