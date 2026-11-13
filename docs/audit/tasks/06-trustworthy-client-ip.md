# 06 — Verify trusted viewer IP and origin enforcement after merge

Implementation and first rollout phase are complete on branch
`fix/trusted-viewer-ip-and-origin`. The existing CloudFront redirect now stamps
`x-site-viewer-ip`; its AWS IPv4/IPv6/redirect tests passed. The API origin custom
header is deployed and its secret matches Parameter Store and the current Lambda.
The current production handler remains permissive until the enforcing PR merges.
See `docs/deployment.md` for resource names, trust model, staging and rollback.

## Remaining after the enforcing PR deploys

- Confirm the direct `4qklz67ic3.execute-api.us-west-2.amazonaws.com/healthcheck`
  returns 403 with `Cache-Control: no-store`, including with forged headers.
- Confirm CloudFront health, bot rendering, cached pages and live APIs still work.
  Run `node scripts/check-live-site.mjs` and the documented cache checks. Confirm
  the www redirect still preserves paths and repeated/encoded query values.
- Exercise the 20/hour Multiple Choice Chess create limit with changing forged
  `X-Forwarded-For`, `CloudFront-Viewer-Address` and `x-site-viewer-ip` headers.
  Confirm the limit returns 429 and Redis uses one real viewer-IP bucket, with no
  forged-address buckets. Keep generated games identifiable and remove only those
  test records afterwards; do not disrupt existing players or erase their quotas.
- Record the actual deployment and verification in `docs/deployment.md`, then
  remove this completed brief from the task folder and update the audit index.

Do not disable the execute-api endpoint: CloudFront uses it as its origin.
Never print or commit the origin secret, Redis credentials or full AWS snapshots.
