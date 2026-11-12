# 06 — Give the rate limiter an address the client can't forge

|            |                                                   |
| ---------- | ------------------------------------------------- |
| Finding    | S2                                                |
| Needs      | AWS credentials (CloudFront, API Gateway) and a repo change |
| Risk       | **Medium.** Touches the default behavior and the API endpoint. |
| Size       | Half a day                                        |
| Depends on | 05 (so only one task edits the distribution at a time) |

## Why

`clientIp()` in `app/utils/rateLimit.server.ts` prefers the `CloudFront-Viewer-Address` header and falls back to the first entry of `X-Forwarded-For`. The first `X-Forwarded-For` entry is whatever the client sent, so until CloudFront supplies a trustworthy header, anyone can dodge every per-IP limit by sending a different value on each request.

Two gaps to close:

1. The Lambda must receive the real viewer address in a header the client cannot set.
2. The API Gateway `execute-api` URL may be reachable directly, bypassing CloudFront. A direct caller can set any header, including whichever one step 1 uses.

## Step 1 — Inspect (read-only)

```bash
aws cloudfront get-distribution-config --id E1TUWNZL0WZZ6J > dist-before.json
jq '.DistributionConfig.DefaultCacheBehavior | {OriginRequestPolicyId, FunctionAssociations, LambdaFunctionAssociations}' dist-before.json
jq '.DistributionConfig.Origins.Items[] | {Id, DomainName, CustomHeaders}' dist-before.json
aws cloudfront get-origin-request-policy --id <OriginRequestPolicyId> --query 'OriginRequestPolicy.OriginRequestPolicyConfig'

# Is the API reachable without CloudFront? The origin DomainName above is the execute-api host.
curl -sS -o /dev/null -w '%{http_code}\n' https://<execute-api-host>/healthcheck
aws apigatewayv2 get-apis --region us-west-2 --query 'Items[].{Name:Name,Id:ApiId,DisableDefault:DisableExecuteApiEndpoint}'
```

Report these results before changing anything.

## Step 2 — Choose how the address is delivered

The constraint: the default behavior must **not** forward the viewer's `Host` header to API Gateway (403 on every request). The managed policy `AllViewerExceptHostHeader` (`b689b0a8-53d0-40ab-baf2-68738e2966ac`) exists for exactly this, and it does not add CloudFront's own headers.

**Option A (recommended): a CloudFront Function sets a custom header.**

A viewer-request function overwrites a header with the address CloudFront saw. Because it runs at the edge and overwrites, a client-supplied value never survives.

```js
// cloudfront-function: viewer-ip
function handler(event) {
  event.request.headers['x-site-viewer-ip'] = { value: event.viewer.ip };
  return event.request;
}
```

- Create and publish it (`aws cloudfront create-function`, `publish-function`, runtime `cloudfront-js-2.0`), then associate it with the default behavior as `viewer-request`.
- Confirm the current origin request policy forwards viewer headers (it must, or nothing reaches the Lambda today). A custom header set by the function is forwarded along with them.
- Repo change: in `clientIp()`, read `x-site-viewer-ip` first, keep `cloudfront-viewer-address` second, keep the `X-Forwarded-For` fallback last. Update `tests/utils/rateLimit.test.ts` and the "Whose address a rate limit sees" section of `docs/deployment.md`. Commit as `fix: …` with no scope.
- Keep the function's source in the repo (for example `infra/cloudfront/viewer-ip.js`) so it is not console-only.

**Option B: an origin request policy that adds `CloudFront-Viewer-Address`.** Simpler in principle and needs no repo change, but the policy type that adds CloudFront headers (`allViewerAndWhitelistCloudFront`) also forwards `Host`. Only use it if you have confirmed against the current AWS documentation that a policy can add that header **without** forwarding `Host`. If unsure, use Option A.

## Step 3 — Close the direct door

If step 1 showed the `execute-api` URL answers directly, pick one:

- **Shared secret header (works with any setup).** Add an origin custom header on the API Gateway origin in the distribution (for example `x-origin-verify: <random 32+ characters>`), store the same value with `npx arc env --add --env production ORIGIN_VERIFY <value>`, and have `server.ts` return 403 when `ARC_ENV === 'production'` and the header does not match. Never commit the value. Roll this out in two deploys: first CloudFront sends the header, then the Lambda starts requiring it.
- **Disable the default endpoint.** Only possible if CloudFront reaches the API through a custom domain rather than the `execute-api` host. If the origin `DomainName` in step 1 *is* the `execute-api` host, disabling it takes the site down. Do not use this option in that case.

## Verify

1. Forge the header and confirm it is ignored. From a machine whose public IP you know:

   ```bash
   for i in $(seq 1 25); do
     curl -sS -o /dev/null -w '%{http_code} ' -X POST https://tylerbarron.com/api/multipleChoiceChess/create \
       -H "X-Forwarded-For: 10.0.0.$i" -H "x-site-viewer-ip: 10.9.9.$i"
   done
   ```

   `create` allows 20 an hour per address. Before this task all 25 succeed; afterwards the last five return `429`.

2. In Redis, the rate-limit keys carry your real address, not `10.x`:

   ```bash
   redis-cli -u "$REDIS_TLS_URL" --scan --pattern 'ratelimit:multipleChoiceChess:create:*'
   ```

3. Direct access is refused: `curl https://<execute-api-host>/healthcheck` returns 403 (shared secret) or fails to connect.

4. The site itself still works: the checks in task 05's Verify section all pass.

## Stop and ask if

- The default behavior already has a function or Lambda@Edge association.
- You cannot tell whether the origin is the `execute-api` host or a custom domain.

## Done when

The forged-header test returns `429` after the limit, direct access to the API is refused, and `docs/deployment.md` describes the function, the header name and the origin secret's variable name (not its value).
