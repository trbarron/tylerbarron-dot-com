# 14 — Find out whether every deploy uploads the images twice

|            |                                   |
| ---------- | --------------------------------- |
| Finding    | D6                                |
| Needs      | AWS read access; repo change if confirmed |
| Risk       | Low to check. **High if `@static` is removed while still in use.** |
| Size       | 1 hour                            |
| Depends on | Nothing                           |

## Why

`app.arc` declares:

```
@static
fingerprint true
folder public
spa true
```

and `build:arc:assets` in `package.json` copies `build/client/*` into `public/` before `arc deploy`. `build/client` already contains a copy of `public/images` (about 18 MB). So `arc deploy` appears to fingerprint and upload the whole image tree to **Architect's own static bucket**, after the workflow has already synced the same files to the CDN bucket (`AWS_BUCKET_NAME`).

If CloudFront reads only from the CDN bucket, Architect's copy serves nothing and costs deploy time on every run. This has never been checked.

## Steps (all read-only)

1. Which buckets does CloudFront read from?

   ```bash
   aws cloudfront get-distribution-config --id E1TUWNZL0WZZ6J \
     --query 'DistributionConfig.Origins.Items[].{Id:Id,Domain:DomainName}' --output table
   aws cloudfront get-distribution-config --id E1TUWNZL0WZZ6J \
     --query 'DistributionConfig.CacheBehaviors.Items[].{Path:PathPattern,Origin:TargetOriginId}' --output table
   ```

2. Which bucket did Architect create?

   ```bash
   aws cloudformation describe-stack-resources --region us-west-2 --stack-name TbWebsiteRemixProduction \
     --query "StackResources[?ResourceType=='AWS::S3::Bucket'].[LogicalResourceId,PhysicalResourceId]" --output table
   aws s3 ls s3://<arc-static-bucket>/ --summarize --recursive | tail -2
   ```

   If the stack name is wrong, list stacks: `aws cloudformation list-stacks --region us-west-2 --query "StackSummaries[?contains(StackName,'TbWebsite')].StackName"`.

3. Does anything else use Architect's bucket? The Lambda gets its name as an environment variable (`ARC_STATIC_BUCKET`), and Architect's HTTP API may have a route that proxies `/_static/*` to it.

   ```bash
   aws apigatewayv2 get-routes --region us-west-2 --api-id <api-id> --query 'Items[].RouteKey'
   grep -rn "_static\|ARC_STATIC" app server.ts
   ```

4. How long does the upload take? Read the `🚀 Production Deploy` step's log in a recent Actions run and find the static asset upload lines.

## Decide

- **Same bucket as the CDN origin:** nothing is duplicated. Record that and close the task.
- **Different bucket, and nothing references it** (no CloudFront origin, no `/_static` use in the app): the upload is waste. Propose, in a PR:
  - remove the `build:arc:assets` step from `build:arc` in `package.json`, and
  - point `@static` at a small folder (for example a `static/` directory containing one placeholder file) rather than deleting the section outright, because removing `@static` makes CloudFormation delete the bucket, which fails if it is not empty and is hard to undo.

  Then check the local sandbox still serves assets: `npm run dev:arc` uses `server.ts`'s static fallback, which reads from `public/` (see the `ARC_ENV !== 'production'` branch). If `build:arc:assets` goes away, that fallback needs to read from `build/client` instead.
- **Different bucket, and something references it:** stop and report what.

## Verify (if a change is made)

`npm run build:arc && npm run check:lambda-deps`, then `npm run dev:arc` and load a page with images and a chess page. After the real deploy: the live-site and cache checks in `docs/deployment.md`, plus images and fonts load on the live site.

## Done when

The question is answered in `docs/deployment.md`, and if the upload was waste, a deploy no longer performs it.
