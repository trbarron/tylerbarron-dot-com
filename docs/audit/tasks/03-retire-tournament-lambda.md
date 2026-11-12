# 03 — Retire the old tournament Lambda

|            |                                              |
| ---------- | -------------------------------------------- |
| Finding    | S7                                           |
| Needs      | AWS credentials (Lambda, IAM, S3 read)       |
| Risk       | **Irreversible deletes.** Owner must approve each one. |
| Size       | 20 minutes                                   |
| Depends on | 02 verified working                          |

## Why

The `camel-up-tournament` Lambda ran strangers' Python and could write to the asset bucket. The site stopped invoking it in PR #128. While it exists, its role and its bucket access are still there. Removing it closes audit finding S7.

Its source lives in the separate repository `trbarron/Camel_Up_Cup_2K18` (`lambda/`). Nothing in this repo deploys it.

## Steps

1. Inventory. Read-only.

   ```bash
   aws lambda get-function --region us-west-2 --function-name camel-up-tournament \
     --query '{role:Configuration.Role,modified:Configuration.LastModified,memory:Configuration.MemorySize}'
   aws lambda get-function-concurrency --region us-west-2 --function-name camel-up-tournament
   aws lambda list-event-source-mappings --region us-west-2 --function-name camel-up-tournament
   ```

   For its role, list what it can do. **Report this to the owner even if nothing else is done**: the audit asked whether this role could write to the whole asset bucket or only `images/camel-up/*`.

   ```bash
   aws iam list-attached-role-policies --role-name <tournament-role>
   aws iam list-role-policies --role-name <tournament-role>
   aws iam get-role-policy --role-name <tournament-role> --policy-name <each-inline-policy>
   ```

2. Confirm nothing has invoked it since the site stopped. Look at the last week of invocations:

   ```bash
   aws cloudwatch get-metric-statistics --region us-west-2 --namespace AWS/Lambda \
     --metric-name Invocations --dimensions Name=FunctionName,Value=camel-up-tournament \
     --start-time "$(date -u -d '7 days ago' +%FT%TZ)" --end-time "$(date -u +%FT%TZ)" \
     --period 86400 --statistics Sum --query 'Datapoints[].[Timestamp,Sum]' --output table
   ```

3. **Stop here and show the owner the inventory.** Get a yes for each of the deletes below before running it.

4. With approval:

   ```bash
   aws lambda delete-function --region us-west-2 --function-name camel-up-tournament
   ```

   Then its role, only if no other function uses it (inline policies and attachments must be removed first):

   ```bash
   aws lambda list-functions --region us-west-2 --query "Functions[?Role=='<tournament-role-arn>'].FunctionName"
   aws iam delete-role-policy --role-name <tournament-role> --policy-name <each>
   aws iam detach-role-policy --role-name <tournament-role> --policy-arn <each>
   aws iam delete-role --role-name <tournament-role>
   ```

5. Remove what the site side no longer needs:

   ```bash
   # The old variable, if it is still stored.
   npx arc env --remove --env production CAMEL_TOURNAMENT_FUNCTION
   # The site role's permission to invoke the tournament. Find it first; the name is unknown.
   aws iam list-role-policies --role-name <site-role>
   aws iam get-role-policy --role-name <site-role> --policy-name <candidate>
   ```

   Delete only a policy whose sole statement is `lambda:InvokeFunction` on `camel-up-tournament`. Do **not** delete `camel-notify` (task 02).

## Do not

- Delete anything under `images/camel-up/` in the asset bucket. `leaderboard.json` there is what the live page reads.
- Delete the Lambda before task 02 is verified: until then it is the only automated path, even though unused.

## Done when

`aws lambda get-function --function-name camel-up-tournament` returns `ResourceNotFoundException`, the README status table records what the tournament role could access, and `docs/deployment.md` no longer mentions the function.
