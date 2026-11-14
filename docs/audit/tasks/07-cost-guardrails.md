# 07 — Confirm budget-alert delivery

The 12 November AWS inspection found an existing API throttle of 50 requests/second,
burst 100, and a USD 5 monthly budget with actual-spend alerts at 80% and 100%
and a forecast alert at 100%. These are sufficient for this hobby site for now.
No new Lambda concurrency cap is planned: observed concurrency reached 56, above
the original proposed cap of 20. Budget alerts do not cap spending.

## Remaining check

With AWS read access, inspect the existing budget's notification subscribers without
printing private addresses. Confirm with the owner that the destination is current
and that budget notifications reach them. Do not create another budget, change the
amount or tune concurrency as part of this task. If delivery needs repair, report
the concrete problem before changing subscriptions.

## Done when

The owner confirms the budget destination and delivery, or explicitly accepts leaving
that check undone. Record the outcome in `docs/deployment.md` and the audit index.
