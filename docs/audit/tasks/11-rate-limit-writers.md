# 11 — Verify the remaining writer limits after deployment

[PR #136](https://github.com/trbarron/tylerbarron-dot-com/pull/136) implements these
per-address hourly limits using the shared `checkRateLimit` helper:

| Endpoint | Requests/hour |
| --- | --- |
| Collaborative Checkmate join | 60 |
| Blunder Watch submit | 10 |
| Chesser Guesser submit | 40 |

Both daily games accept only today’s or yesterday’s submissions; Chesser Guesser
retains its existing local-calendar day definition, while Blunder Watch uses UTC.
The username cooldown remains, and Chesser Guesser’s completed counter uses `INCR`
and `EXPIRE`. Regression tests cover quota exhaustion, date validation and counters.
All 570 tests passed in CI, including the real-Redis suites.

## Remaining verification

Merge and deploy PR #136, then confirm the endpoints behave normally and the deployment
passes its bot/Redis checks. Do not flood production just to repeat quota tests already
covered in CI. Update the audit status table and remove this brief once deployed.

Task 06 remains separate: until the client-IP header is trustworthy and the direct API
bypass is closed, a determined caller can evade per-address quotas. That does not
require reimplementing these endpoint limits.
