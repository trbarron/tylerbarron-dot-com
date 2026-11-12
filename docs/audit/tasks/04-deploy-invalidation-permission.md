# 04 — Let the deploy invalidate CloudFront

|            |                              |
| ---------- | ---------------------------- |
| Finding    | P1 (follow-up)               |
| Needs      | AWS credentials (IAM)        |
| Risk       | Low. Adds one narrow permission. |
| Size       | 10 minutes                   |
| Depends on | Nothing                      |

## Why

`.github/workflows/deploy.yml` ends with two non-blocking steps added in PR #128:

- `🧹 Invalidate cached pages` runs `aws cloudfront create-invalidation --paths '/*'`.
- `🧹 Prune old assets` runs `scripts/prune-old-assets.mjs`, which lists and deletes objects under `assets/` in the asset bucket.

Both use the deploy's AWS access keys. Both are `continue-on-error`, so a missing permission does not fail the deploy; it just silently does nothing.

## Steps

1. Check whether they already work. Open the most recent `🚀 Deploy` run on `master` in GitHub Actions and read the logs of those two steps.

   - Invalidation succeeded if the log shows an `Invalidation` object with an `Id`.
   - Prune succeeded if the log shows a line like `N objects under assets/, M in this build, K to prune.`
   - `AccessDenied` in either means the permission is missing.

   If both succeeded, this task is done: record that and stop.

2. Find which IAM principal the deploy uses. The access key id is in the repository secret `AWS_ACCESS_KEY_ID`; you cannot read the secret, so ask the owner for the IAM user name, or find the user whose key was last used by `cloudformation`:

   ```bash
   aws iam list-users --query 'Users[].UserName' --output text
   aws iam list-access-keys --user-name <candidate> --query 'AccessKeyMetadata[].AccessKeyId'
   aws iam get-access-key-last-used --access-key-id <key-id>
   ```

3. Add the invalidation permission, scoped to this one distribution:

   ```bash
   ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
   aws iam put-user-policy --user-name <deploy-user> --policy-name invalidate-site \
     --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"cloudfront:CreateInvalidation\",\"Resource\":\"arn:aws:cloudfront::${ACCOUNT}:distribution/E1TUWNZL0WZZ6J\"}]}"
   ```

4. Only if the prune step showed `AccessDenied`: it needs `s3:ListBucket` on the asset bucket and `s3:DeleteObject` on `assets/*`. The old workflow ran `aws s3 sync --delete` on the same prefix, so these are probably present. If not, add them the same way, scoped to that bucket and prefix.

## Verify

Re-run the deploy workflow on `master` (or wait for the next merge) and read the two steps' logs again.

## Done when

Both steps succeed in a real deploy run, and the README status table says so.

## Note

Task 09 replaces these long-lived keys with an OIDC role. If 09 is done first, grant these permissions to that role instead.
