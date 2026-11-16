# Site runtime monitoring

Applied definitions captured on 13 November 2026. These are operational source
files, not a CloudFormation stack: changing a JSON file alone does not update AWS.
The recipient address is deliberately absent.

- `runtime-alarms.json`: per-region CloudWatch `put-metric-alarm` configurations.
  Each `Configuration` is a CLI input object; `Region` selects the AWS endpoint.
- `site-healthcheck.json`: Route 53 `HealthCheckConfig` for the existing external
  HTTPS/string-match monitor. Do not run `create-health-check` again to edit it.
- `topic-policies.json`: regional operational SNS topic policies, preserving owner
  access and granting publication only to the exact site alarm ARNs/source account.
- `resources.json`: created health check ID and topic ARNs.

`docs/deployment.md` describes the thresholds, current verification state and
private backup location. Save fresh AWS configurations before changing anything.
Task 26 can later import these resources into managed infrastructure.
