# 26 — Put the hand-made AWS resources into code

|            |                                         |
| ---------- | --------------------------------------- |
| Finding    | D5                                      |
| Needs      | AWS credentials (read, then CloudFormation) and a repo change |
| Risk       | **High if done carelessly.** Importing or recreating a live CloudFront distribution can take the site down. |
| Size       | 2 to 3 days                             |
| Depends on | 05, 06, 07, 08, 15 (so their results are what gets captured) |

## Why

Architect manages the Lambda and the HTTP API. Everything else was made by hand in the console and is described only in prose in `docs/deployment.md`:

- the CloudFront distribution `E1TUWNZL0WZZ6J`, its origins, behaviors, cache and origin-request policies, any function, and the response headers policy;
- the asset bucket and its policy;
- the SNS topics, alarms and budget from tasks 02, 07 and 08;
- IAM additions: the site role's inline policies, the deploy user or role.

If any of it is lost or mis-edited, there is nothing to rebuild from.

## Stage 1 — Capture (read-only, safe, valuable on its own)

Export the current state into the repo so it is at least recorded and diffable:

```bash
mkdir -p infra/snapshot
aws cloudfront get-distribution-config --id E1TUWNZL0WZZ6J > infra/snapshot/distribution.json
# for each policy id referenced in that file:
aws cloudfront get-cache-policy --id <id> > infra/snapshot/cache-policy-<name>.json
aws cloudfront get-origin-request-policy --id <id> > infra/snapshot/origin-request-policy-<name>.json
aws cloudfront get-response-headers-policy --id <id> > infra/snapshot/response-headers-policy-<name>.json
aws s3api get-bucket-policy --bucket <asset-bucket> --query Policy --output text | jq . > infra/snapshot/bucket-policy.json
```

**Before committing, read every file for secrets.** An origin custom header used as a shared secret (task 06) appears in `distribution.json` in plain text: replace its value with a placeholder. The repo is public. Account ids and ARNs are not secret, but check with the owner whether they want them published.

Add `infra/README.md` saying what each file is, when it was captured and how to refresh it. This stage alone closes most of the finding.

## Stage 2 — Manage (only with the owner's explicit go-ahead)

Options, least to most invasive:

1. **Policies and functions only.** Create a small CloudFormation stack that owns the cache policy, origin request policy, response headers policy and CloudFront function, then point the existing distribution at the stack-managed ids (an `update-distribution` with a saved config and ETag). The distribution itself stays hand-managed. Low risk.
2. **Import the distribution** into a stack with CloudFormation resource import. The template must match the live config exactly or the first update will change it. Do it with a change set, read the change set line by line, and have the distribution rollback described in `docs/deployment.md` ready.
3. **Recreate from scratch.** Do not. A new distribution means a new domain name, DNS changes and certificate re-association.

Option 1 is the recommended stopping point. Whatever is created, keep templates under `infra/` and add a section to `docs/deployment.md`.

## Do not

- Put the CloudFront distribution inside the Architect app's stack. `arc deploy --prune` and stack updates would then be able to replace it.
- Commit a secret. See Stage 1.

## Done when

Stage 1 is merged. Stage 2 is either done to the level the owner chose or recorded as declined.
