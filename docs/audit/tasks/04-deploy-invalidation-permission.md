# 04 — Verify invalidation on the next deploy

The permission change is applied. IAM user `remix-deployer` has inline policy
`invalidate-site`, scoped to distribution `E1TUWNZL0WZZ6J`; IAM simulation returned
`allowed`. Configuration source: `infra/iam/site-invalidation.json`. The previous
prune step already succeeded. Resource details are in `docs/deployment.md`
("Deploy invalidation permission").

## Remaining verification

After the next production deploy, inspect the two cleanup steps in GitHub Actions:

- Invalidation must return an `Invalidation` object with an ID, without `AccessDenied`.
- Pruning must report its object/build/prune counts without an error.

Both steps are non-blocking, so a green workflow alone does not prove they ran
successfully. Record the run and result in the audit status table. Do not add another
policy unless inspection shows a new permission gap. Task 09 must preserve these
permissions when replacing the deploy user with an OIDC role.
