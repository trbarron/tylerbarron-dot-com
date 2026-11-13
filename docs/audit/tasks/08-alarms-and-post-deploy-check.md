# 08 — Verify runtime alert delivery

Post-deploy bot checks are deployed and verified. Four runtime/uptime alarms and
two regional operational SNS topics were configured on 13 November 2026. Definitions
are in `infra/monitoring/`; exact names, thresholds and health check ID are in
`docs/deployment.md` ("Runtime monitoring"). Do not recreate these resources.

All four alarms reached `OK`; Route 53 probes in all three configured regions
returned HTTP 200 and matched `OK`, and the uptime metric reported healthy
datapoints over both evaluation windows. No notification recipient has been
subscribed yet; a question about using the previously supplied owner address is
pending. The Camel Up Cup topic is separate and unchanged.

## Remaining work

1. Obtain the owner's operational-alert recipient choice. Subscribe it once to
   each `site-runtime-alerts` topic (`us-west-2` and `us-east-1`); have the owner
   confirm both SNS emails. Do not commit subscriber addresses.
2. Recheck all four alarm states before notification testing; any real alarm needs
   investigation. The initial uptime metric and `OK` state are already verified.
3. Exercise each of the four alarms with `set-alarm-state --state-value ALARM` and
   a clearly labeled verification reason. Confirm action history records successful
   SNS publication and the owner receives each named alarm email. This tests
   notifications without breaking the website or manufacturing real failures.
4. Let real evaluation return the alarms to their current data-derived states;
   investigate any real alarm instead of suppressing it.
5. Record verified delivery in deployment docs and the audit index. Delete this
   brief only after those checks pass.

Before changes, save existing configurations. Original snapshots are retained in
`/private/tmp/site-runtime-alarms-20261113`; these resources had no predecessor site
alarms or health check. No app deploy is needed for the AWS alarm configuration.
