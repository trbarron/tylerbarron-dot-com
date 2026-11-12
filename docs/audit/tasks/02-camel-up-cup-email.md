# 02 — Set up the Camel Up Cup submission email

|            |                                        |
| ---------- | -------------------------------------- |
| Finding    | S7 (replacement flow)                  |
| Needs      | AWS credentials (SNS, IAM, Lambda read) |
| Risk       | Low. Creates new resources; changes nothing existing. |
| Size       | 20 minutes, plus the owner clicking a confirmation email |
| Depends on | 01                                     |

## Why

Since PR #128 the site no longer runs submitted bots. `POST /api/camelUpCup/submit` stores the bot in the Redis hash `camelup:pending` and publishes to the SNS topic named in `CAMEL_NOTIFY_TOPIC_ARN` (`app/utils/camelUpCup/tournament.server.ts`, `notifySubmission`). That variable is not set in production yet, so bots are being queued silently: nobody is told.

## Ask the owner first

- Which email address should receive submissions. Do not guess it and do not write it into the repo; it lives only in the SNS subscription.

## Steps

1. Create the topic and subscribe the address.

   ```bash
   aws sns create-topic --name camel-up-cup-submissions --region us-west-2 --query TopicArn --output text
   aws sns subscribe --region us-west-2 --protocol email \
     --topic-arn <topic-arn> --notification-endpoint <owner-email>
   ```

   SNS emails a confirmation link. The owner must click it. Until then the subscription shows `PendingConfirmation` and nothing is delivered:

   ```bash
   aws sns list-subscriptions-by-topic --region us-west-2 --topic-arn <topic-arn> \
     --query 'Subscriptions[].SubscriptionArn'
   ```

2. Find the site Lambda and its role. The Architect app is `tb-website-remix`, so the function name should contain `TbWebsiteRemixProduction`; confirm rather than assume.

   ```bash
   aws lambda list-functions --region us-west-2 \
     --query "Functions[?contains(FunctionName,'TbWebsiteRemix')].[FunctionName,Role]" --output table
   ```

   Expect one production function for the `/*` route. The role name is the part of the role ARN after `role/`.

3. Allow that role to publish to this topic and nothing else.

   ```bash
   aws iam put-role-policy --role-name <role-name> --policy-name camel-notify \
     --policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":"sns:Publish","Resource":"<topic-arn>"}]}'
   ```

   This is an inline policy added outside CloudFormation. Architect redeploys do not remove it, but recreating the stack would. Record it in `docs/deployment.md`.

4. Tell the site where to publish. `app.arc` already lists `CAMEL_NOTIFY_TOPIC_ARN` under `@env production` with no value; the value is stored with:

   ```bash
   npx arc env --add --env production CAMEL_NOTIFY_TOPIC_ARN <topic-arn>
   ```

   It takes effect on the next deploy. Ask the owner to re-run the `🚀 Deploy` workflow on `master`.

## Verify

After the deploy and after the owner has confirmed the subscription:

1. Publish directly, to prove the topic and subscription work:

   ```bash
   aws sns publish --region us-west-2 --topic-arn <topic-arn> \
     --subject 'Camel Up Cup: test' --message 'Test from task 02.'
   ```

   The owner should receive it within a minute.

2. Submit a real bot through the site at `https://tylerbarron.com/camel-up-cup` (any valid `.py` with a class and a `move(player, gamestate)` method returning `[0]`). The page should say the bot is entered, and the owner should get an email containing the code.

3. Confirm it is in the queue, then remove the test entry:

   ```bash
   npm run camel:queue                 # needs REDIS_URL or REDIS_TLS_URL in .env
   npm run camel:queue -- done <id>
   ```

If step 1 works and step 2 sends no email, read the Lambda's CloudWatch logs for `Camel Up Cup:`. `AccessDenied` means the role policy in step 3 is wrong; a "not set" warning means the deploy has not picked up the variable.

## Stop and ask if

- More than one production function matches in step 2.
- A topic named `camel-up-cup-submissions` already exists with subscriptions you did not create.

## Done when

A bot submitted on the live site produces an email, and `docs/deployment.md` records the topic name and the inline policy name.
