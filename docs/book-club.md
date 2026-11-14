# Book club voting (shadow launch)

Open `/book-club` directly to create a poll. It is intentionally absent from the
homepage, navigation, sitemap and feed. The pages and API send `noindex` and
`no-store`; book-club page loads omit analytics. This is unlisted, not an
invitation-only authentication system: anyone who knows the creation URL can use it.

## Host flow

Enter a poll name and 3–30 distinct books, one per line (author text is optional).
Creating fixes the list and opens the host dashboard. Copy the voter invite link
for the club. Save the separate **private host link** to manage the vote from a
second browser or device. Its token is in the URL fragment, consumed into local
storage and removed from the address bar. Do not share it with voters.

The dashboard refreshes every five seconds while visible. It shows joined names,
which ballots are locked, without running vote totals. It does not show each
person's choices. The host can close voting permanently, including while some
people are still choosing; only submitted ballots count. Closing reveals totals to everyone with the invite link. Tied scores stay
tied; their display order follows the original list.

The host can vote too by opening the ordinary invite link and entering their name.

## Voter flow

Open the invite and enter a recognizable name (maximum 40 characters). Names are
unique within a poll after normalization and case folding. Use an initial if two
people have the same name. This is an honor-system club tool, with no accounts or
identity verification. A different browser cannot reclaim someone else's name.

Choose two **different** books up and a third book down. Choices can be changed
until the confirmation to lock in; a submitted ballot is final. Each upvote adds
one point and each downvote subtracts one. Draft choices stay in React state;
refreshing an unsubmitted ballot clears the draft. The local browser retains the
voter token so a refresh or return visit restores the joined name and final ballot.
Keep using the same browser; clearing storage loses that session.

## Storage and limits

A poll uses one Redis key, `bookClub:poll:<random-id>`, with a fixed 30-day TTL from
creation. Joining, voting, reading and closing never extend it. At expiry the
list, voter names and ballots disappear together. Host/voter tokens are random
256-bit credentials; Redis stores only their SHA-256 hashes. Responses never
include tokens. Public reads show the list and open/closed state; only the host
sees participant status. Neither hosts nor voters see totals while voting is open.
Closed polls expose aggregate totals.

Redis Lua makes joins, lock-in and closing atomic. Limits: 100 voters per poll,
10 creations per address/hour and 120 writes per action/address/hour. Requests
are size-limited and shape-validated before quota checks; book membership and
state are checked atomically before poll writes. Redis outages return
a retryable error, without a fallback store or a false success message.

## Verification

`TEST_REDIS_URL=redis://127.0.0.1:16380 npm test` exercises the actual Lua scripts:
concurrent joins and submissions, duplicate names, finality, role separation,
invalid ballots, closure and expiry that cannot resurrect a poll. The URL must
be local; tests refuse a remote Redis and delete only their own created poll keys.

Run the usual lint, typecheck, format, design, production build, Lambda dependency
and OG checks. Screenshots for this new route can use:

```bash
npm run pr-screenshots -- --route /book-club --allow-missing-before
```

The opt-in flag accepts the expected production 404 as the before image. It does
not allow an after-page failure or relax existing-route checks.
