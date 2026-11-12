# 01 — Confirm production is healthy after the Redis TLS change

|            |                                                        |
| ---------- | ------------------------------------------------------ |
| Finding    | S3 (follow-up)                                         |
| Needs      | Internet access; AWS credentials only if a fix is needed |
| Risk       | Low to check. The fix is one environment variable.     |
| Size       | 10 minutes                                             |
| Depends on | Nothing. **Do this first.**                            |

## Why

PR #128 turned on TLS certificate verification for Redis (`app/utils/redis.server.ts`) and was deployed before anyone checked the Redis provider's certificate. If that certificate is not signed by a public CA, every Redis call in production now fails: the games, the leaderboards, Runescape Rascals, the rate limits (which fail open) and the Camel Up Cup queue.

Nobody has confirmed either way. The audit session could not reach the site.

## Steps

1. Request the healthcheck. It pings Redis and nothing else.

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://tylerbarron.com/healthcheck
   curl -sS https://tylerbarron.com/healthcheck
   ```

   - `200` and `OK`: Redis is reachable and the certificate verifies. Skip to step 4.
   - `503` and `Redis NOT READY`, or `500`: continue.

2. Find out why. Get the Redis host and port **without printing the password**:

   ```bash
   # Prints only scheme, host and port.
   npx arc env --env production 2>/dev/null | grep -E '^\s*REDIS_(TLS_)?URL' \
     | sed -E 's#(rediss?://)[^@]*@#\1***@#'
   ```

   If the URL starts with `redis://` (one `s`), there is no TLS and the certificate is not the cause: stop and report what the healthcheck returned.

   If it starts with `rediss://`, test the certificate:

   ```bash
   openssl s_client -connect <host>:<port> -servername <host> -verify_return_error </dev/null 2>&1 \
     | grep 'Verify return code'
   ```

3. If the return code is anything other than `0 (ok)`, restore the old behaviour and redeploy:

   ```bash
   npx arc env --add --env production REDIS_TLS_REJECT_UNAUTHORIZED 0
   ```

   Environment variables reach the Lambda on the next deploy. Ask the owner to re-run the latest `🚀 Deploy` workflow on `master`, or run it with `workflow_dispatch`. Then repeat step 1.

   Record in `docs/deployment.md` (the Redis section) that the opt-out is set and why. The better long-term fix is to pin the provider's CA with `tls.ca` instead of disabling verification; note that as a follow-up, do not attempt it here.

4. Spot-check one real Redis-backed endpoint:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' https://tylerbarron.com/api/multipleChoiceChess/available
   ```

   Expect `200`.

## Stop and ask if

- The healthcheck fails but the certificate verifies. The cause is something else (a wrong URL, the provider being down, the 5-second command timeout). Report the status code and body; do not change anything.
- `npx arc env` asks for credentials you do not have.

## Done when

`/healthcheck` returns `200 OK`, and the README status table says which of the two outcomes applied (certificate verifies, or opt-out set).
