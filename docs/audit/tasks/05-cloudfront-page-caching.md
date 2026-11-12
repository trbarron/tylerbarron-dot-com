# 05 — Make CloudFront honour the pages' cache headers

|            |                                               |
| ---------- | --------------------------------------------- |
| Finding    | P1                                            |
| Needs      | AWS credentials (CloudFront)                  |
| Risk       | **Medium to high.** A wrong setting on the default behavior can cache pages that must not be cached, or break every request. Follow the order exactly and keep the saved config for rollback. |
| Size       | 1 hour                                        |
| Depends on | 01, 04                                        |

## Why

Since PR #128 these pages send `Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=86400` (`app/utils/cache.ts`): the homepage, blog posts, and the static project pages listed in `tests/utils/pageCache.test.ts`. The intent is that CloudFront serves them from the edge and the Lambda runs only to refresh.

Whether that happens depends on the cache policy of the distribution's **default behavior**, which is not in this repo and has never been inspected.

## What must stay true afterwards

- A response with **no** `Cache-Control` header is **never** cached. Game pages, Chesser Guesser and most API responses rely on this.
- `no-store` responses are never cached.
- The query string is part of the cache key. Several endpoints vary by it (`?date=`, `?gameId=`, `?deck=`, `?town=`).
- `POST` and `PUT` reach the Lambda untouched.
- The `Host` header is **not** forwarded to the API Gateway origin. Forwarding it makes API Gateway reject every request with 403.

## Steps

1. Save the current config. This file is your rollback.

   ```bash
   aws cloudfront get-distribution-config --id E1TUWNZL0WZZ6J > dist-before.json
   jq '.DistributionConfig.DefaultCacheBehavior
       | {TargetOriginId, CachePolicyId, OriginRequestPolicyId, ResponseHeadersPolicyId,
          ForwardedValues, MinTTL, DefaultTTL, MaxTTL, AllowedMethods: .AllowedMethods.Items}' dist-before.json
   jq '.DistributionConfig.CacheBehaviors.Items[] | {PathPattern, TargetOriginId, CachePolicyId}' dist-before.json
   ```

2. Read the result and pick the case.

   - **Case A — `CachePolicyId` is `4135ea2d-6df8-44a3-9df3-4b5a84be39ad`** (the managed `CachingDisabled` policy). Nothing is cached today. Go to step 3.
   - **Case B — `CachePolicyId` is some other id.** Describe it:

     ```bash
     aws cloudfront get-cache-policy --id <id> --query 'CachePolicy.CachePolicyConfig'
     ```

     If it already has `MinTTL: 0`, `DefaultTTL: 0`, query strings `all`, cookies `none`, headers `none`, there is nothing to change: go to Verify. If `DefaultTTL` is greater than 0, **stop and report**: responses without a `Cache-Control` header are being cached today, which is a bug in its own right.
   - **Case C — `CachePolicyId` is null and `ForwardedValues` is present** (legacy settings). **Stop and report the JSON to the owner.** Converting legacy settings also requires choosing an origin request policy that forwards the same things as before, minus `Host`; that needs a decision, not a recipe.

3. Create the cache policy (Case A).

   ```bash
   aws cloudfront create-cache-policy --cache-policy-config '{
     "Name": "site-honour-origin",
     "Comment": "Cache only what the origin marks cacheable; key on the query string.",
     "MinTTL": 0, "DefaultTTL": 0, "MaxTTL": 31536000,
     "ParametersInCacheKeyAndForwardedToOrigin": {
       "EnableAcceptEncodingGzip": true, "EnableAcceptEncodingBrotli": true,
       "HeadersConfig": {"HeaderBehavior": "none"},
       "CookiesConfig": {"CookieBehavior": "none"},
       "QueryStringsConfig": {"QueryStringBehavior": "all"}
     }}' --query 'CachePolicy.Id' --output text
   ```

   `DefaultTTL: 0` is the important number: it is what keeps header-less responses uncached.

4. Apply it to the default behavior only. Leave `OriginRequestPolicyId` and every other behavior exactly as they are.

   ```bash
   ETAG=$(jq -r .ETag dist-before.json)
   jq --arg id <new-policy-id> '.DistributionConfig | .DefaultCacheBehavior.CachePolicyId = $id' \
     dist-before.json > dist-after.json
   diff <(jq -S .DistributionConfig dist-before.json) <(jq -S . dist-after.json)   # expect one changed line
   aws cloudfront update-distribution --id E1TUWNZL0WZZ6J --if-match "$ETAG" \
     --distribution-config file://dist-after.json --query 'Distribution.Status'
   aws cloudfront wait distribution-deployed --id E1TUWNZL0WZZ6J
   ```

## Verify

Run all of these. Request each URL twice, a few seconds apart, and read the second response.

```bash
h() { curl -sS -o /dev/null -D - "$1" | grep -iE '^(HTTP|cache-control|x-cache|age):'; }

h https://tylerbarron.com/                      # expect: x-cache Hit (or RefreshHit), an age header
h https://tylerbarron.com/blog/2026Goals        # expect: Hit
h https://tylerbarron.com/chesser-guesser       # expect: Miss both times, no cache-control
h https://tylerbarron.com/marginal-maia-mentor  # expect: Miss both times
h "https://tylerbarron.com/api/multipleChoiceChess/available"   # expect: Miss both times
h https://tylerbarron.com/healthcheck           # expect: Miss both times (no-store)
```

Then functional checks:

- `curl -sS -X POST https://tylerbarron.com/api/multipleChoiceChess/create` returns JSON with a `game_id`.
- Load `https://tylerbarron.com/chesser-guesser` twice in a browser; the position differs between loads.
- `curl -sS https://tylerbarron.com/blog/does-not-exist -o /dev/null -w '%{http_code}\n'` returns `404`, and a second request is not a `Hit`.

Endpoints that already send `public, max-age=…` will now also be cached at the edge, by design: the Chesser Guesser puzzles and leaderboard, Blunder Watch game and leaderboard, the Media Profile public list, Runescape Rascals snapshot and images, `/feed.xml`, `/sitemap.xml`, `/robots.txt`. Confirm one: `h "https://tylerbarron.com/api/runescapeRascals/snapshot"` should be a `Hit` within 10 seconds.

## Roll back

```bash
ETAG=$(aws cloudfront get-distribution-config --id E1TUWNZL0WZZ6J --query ETag --output text)
jq .DistributionConfig dist-before.json > dist-restore.json
aws cloudfront update-distribution --id E1TUWNZL0WZZ6J --if-match "$ETAG" --distribution-config file://dist-restore.json
aws cloudfront create-invalidation --distribution-id E1TUWNZL0WZZ6J --paths '/*'
```

Roll back immediately if any "expect: Miss" check above returns a `Hit`, or anything returns 403.

## Done when

All verification checks pass, `docs/deployment.md` (section "Pages cached at the edge") names the policy and its id, and the README status table is updated.
