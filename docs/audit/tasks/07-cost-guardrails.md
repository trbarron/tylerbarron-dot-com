# 07 — Bound the worst-case AWS bill

|            |                                      |
| ---------- | ------------------------------------ |
| Finding    | S8                                   |
| Needs      | AWS credentials (API Gateway, Lambda, Budgets) |
| Risk       | Low to medium. A limit set too low throttles real visitors. |
| Size       | 30 minutes                           |
| Depends on | Nothing                              |

## Why

The site is a 2 GB Lambda behind API Gateway, reachable by anyone, with API Gateway's default throttle (thousands of requests a second). A flood, deliberate or a runaway crawler, is billed per invocation. Nothing caps it and nothing alerts.

## Steps

1. Inspect. Read-only.

   ```bash
   aws apigatewayv2 get-apis --region us-west-2 --query 'Items[].{Name:Name,Id:ApiId}'
   aws apigatewayv2 get-stages --region us-west-2 --api-id <api-id> \
     --query 'Items[].{Stage:StageName,Throttle:DefaultRouteSettings}'
   aws lambda get-function-concurrency --region us-west-2 --function-name <site-function>
   aws lambda get-account-settings --region us-west-2 --query AccountLimit
   aws budgets describe-budgets --account-id "$(aws sts get-caller-identity --query Account --output text)" \
     --query 'Budgets[].{Name:BudgetName,Limit:BudgetLimit}'
   ```

2. Look at real traffic before choosing numbers, so the limits sit well above it:

   ```bash
   aws cloudwatch get-metric-statistics --region us-west-2 --namespace AWS/Lambda \
     --metric-name ConcurrentExecutions --dimensions Name=FunctionName,Value=<site-function> \
     --start-time "$(date -u -d '14 days ago' +%FT%TZ)" --end-time "$(date -u +%FT%TZ)" \
     --period 3600 --statistics Maximum --query 'max(Datapoints[].Maximum)'
   ```

3. Propose numbers to the owner and get agreement. Starting points for a personal site, to be raised if step 2 shows more:

   | Setting | Suggested | Effect when exceeded |
   | --- | --- | --- |
   | API stage throttle | 50 requests/second, burst 100 | API Gateway returns 429 |
   | Lambda reserved concurrency | 20 | Excess requests get 429/503 |
   | Monthly budget | The owner's number, alerts at 80% and 100% | Email only; nothing is switched off |

   The live games poll about once a second per player, so a busy evening is a few requests a second, not fifty.

4. Apply.

   ```bash
   aws apigatewayv2 update-stage --region us-west-2 --api-id <api-id> --stage-name <stage> \
     --default-route-settings ThrottlingRateLimit=50,ThrottlingBurstLimit=100
   aws lambda put-function-concurrency --region us-west-2 --function-name <site-function> \
     --reserved-concurrent-executions 20
   ```

   The account must keep at least 100 unreserved concurrent executions; `put-function-concurrency` fails otherwise. If the account limit is low (new accounts start at 10), skip reserved concurrency and say so.

   Budget: create it with `aws budgets create-budget` and an email subscriber, or in the Billing console. The email address comes from the owner; do not put it in the repo.

## Caution

Architect manages the Lambda and the API through CloudFormation. A later `arc deploy` may reset settings changed outside it. After the next deploy, re-run the inspection in step 1. If a setting was reset, it needs to move into `app.arc` or a `@cloudformation` macro instead (see task 27); report that rather than re-applying it by hand each time.

## Verify

- The site loads and a game can be created: `curl -sS -X POST https://tylerbarron.com/api/multipleChoiceChess/create` returns JSON.
- `aws apigatewayv2 get-stages` and `aws lambda get-function-concurrency` show the new values.
- Throttle metric stays at zero for a normal day: `AWS/Lambda` `Throttles` for the function.

## Done when

The three limits are in place (or the reason one was skipped is recorded), they survive a deploy, and `docs/deployment.md` lists them.
