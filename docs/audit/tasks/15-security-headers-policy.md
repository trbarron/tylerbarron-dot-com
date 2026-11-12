# 15 — Send the security headers on every response

|            |                              |
| ---------- | ---------------------------- |
| Finding    | S6.4                         |
| Needs      | AWS credentials (CloudFront) |
| Risk       | Low to medium. Wrong CSP here would break pages; this task deliberately leaves CSP out. |
| Size       | 1 hour                       |
| Depends on | 05, 06 (finish other distribution changes first) |

## Why

`app/entry.server.tsx` sets `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Permissions-Policy` on HTML documents only. Files served from the bucket (`/assets/*`, `/fonts/*`, `/images/*`) and API responses get none of them. `X-Content-Type-Options: nosniff` in particular matters for the JSON and image files in the bucket.

## The change

Create one CloudFront response headers policy and attach it to **every** behavior of distribution `E1TUWNZL0WZZ6J` (the default and the three bucket behaviors).

Headers, with override **off** so the Lambda's own values win where it sets them:

| Header | Value |
| --- | --- |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `X-Frame-Options` | `DENY` |

Do **not** put `Content-Security-Policy` in this policy. The site's CSP differs per page (`app/utils/csp.server.ts`: the Maia page allows `'unsafe-eval'`, others do not) and is set by the Lambda. A second, static CSP from CloudFront would be combined with it by the browser and the stricter one would win everywhere, breaking Maia.

Do not add `Permissions-Policy` here either unless you copy the value from `entry.server.tsx` exactly; a mismatch is harmless but confusing.

## Steps

1. Save the config: `aws cloudfront get-distribution-config --id E1TUWNZL0WZZ6J > dist-before.json`. Note any `ResponseHeadersPolicyId` already set on any behavior; if one exists, stop and report it.
2. `aws cloudfront create-response-headers-policy` with the four headers under `SecurityHeadersConfig`, each with `"Override": false`.
3. Set `ResponseHeadersPolicyId` on `DefaultCacheBehavior` and on each item of `CacheBehaviors.Items`, then `update-distribution` with the saved `ETag`, following "Changing CloudFront safely" in `docs/deployment.md`. Diff before and after: only those fields change.
4. `aws cloudfront wait distribution-deployed --id E1TUWNZL0WZZ6J`.

## Verify

```bash
for u in / /blog/2026Goals /api/multipleChoiceChess/available /fonts/inter-latin-wght-normal.woff2; do
  echo "== $u"; curl -sS -o /dev/null -D - "https://tylerbarron.com$u" \
    | grep -iE '^(strict-transport|x-content-type|referrer-policy|x-frame|content-security)'
done
```

- All four headers on every URL.
- `content-security-policy` appears **once** on HTML pages and not at all on the font.
- `https://tylerbarron.com/marginal-maia-mentor` still has `'unsafe-eval'` in its CSP, and the homepage has `'wasm-unsafe-eval'` only.
- Blog comments (the giscus iframe) and embedded YouTube videos still load: `X-Frame-Options: DENY` applies to this site being framed, not to frames it embeds.

Roll back with the saved config following "Changing CloudFront safely" in `docs/deployment.md`.

## Done when

The checks pass and `docs/deployment.md` names the policy.
