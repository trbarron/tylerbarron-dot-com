# 09 — Replace the deploy's long-lived AWS keys with OIDC

|            |                                         |
| ---------- | --------------------------------------- |
| Finding    | D4                                      |
| Needs      | AWS credentials (IAM) and a repo change |
| Risk       | **Medium.** A mistake breaks deploys, not the live site. |
| Size       | Half a day                              |
| Depends on | 04 (so the permissions it adds are known) |

## Why

`.github/workflows/deploy.yml` authenticates with `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` stored as repository secrets. They never expire, and anyone who obtains them can do whatever that IAM user can, from anywhere. GitHub can instead exchange a short-lived token for a role that only this repository's `master` branch may assume.

## Steps

1. Record what the current deploy user can do. The new role needs the same, no more.

   ```bash
   aws iam list-attached-user-policies --user-name <deploy-user>
   aws iam list-user-policies --user-name <deploy-user>
   aws iam list-groups-for-user --user-name <deploy-user>
   ```

   If it has `AdministratorAccess`, say so in your report. Narrowing it is worth doing but is a separate decision; for this task, attach the same policies to the new role so behaviour does not change, and list "scope the deploy role down" as a follow-up.

2. Create the GitHub OIDC provider if the account does not have one:

   ```bash
   aws iam list-open-id-connect-providers
   aws iam create-open-id-connect-provider --url https://token.actions.githubusercontent.com \
     --client-id-list sts.amazonaws.com
   ```

3. Create the role with a trust policy limited to this repo's deploy. Using a GitHub environment makes the condition exact:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": {"Federated": "arn:aws:iam::<account>:oidc-provider/token.actions.githubusercontent.com"},
       "Action": "sts:AssumeRoleWithWebIdentity",
       "Condition": {
         "StringEquals": {
           "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
           "token.actions.githubusercontent.com:sub": "repo:trbarron/tylerbarron-dot-com:environment:production"
         }
       }
     }]
   }
   ```

   Attach the policies from step 1 and the invalidation policy from task 04.

4. In GitHub, create an environment named `production` restricted to the `master` branch (Settings → Environments). The owner does this.

5. Change the workflow, in the `deploy` job only:

   - Add `environment: production`.
   - Add `id-token: write` to the job's `permissions` (keep `contents: write`).
   - Add one step before the first AWS call:

     ```yaml
     - name: 🔑 AWS credentials
       uses: aws-actions/configure-aws-credentials@<current major>
       with:
         role-to-assume: arn:aws:iam::<account>:role/<role-name>
         aws-region: us-west-2
     ```

   - Remove every `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION` and `AWS_REGION` entry from the steps' `env:` blocks. The action exports them for the rest of the job.
   - Keep `AWS_BUCKET_NAME` and `VITE_CDN_URL` as they are.

   The role ARN is not a secret, but it contains the account id. Store it as a repository **variable** (`vars.AWS_DEPLOY_ROLE`) rather than writing it in the file.

6. Open a PR (`ci: …`). The PR's own checks do not exercise the deploy job, so the first real test is the merge.

## Verify

- The deploy run after merging succeeds end to end, including the S3 sync, `arc deploy`, the invalidation and the prune.
- Only after that: delete the old access key (`aws iam delete-access-key`) and the two repository secrets. Keep the IAM user until one more deploy has succeeded.

## Roll back

Revert the workflow commit. The old secrets still work until you delete them, which is why deletion comes last.

## Done when

Two consecutive deploys succeed with no long-lived AWS key in the repository's secrets.
