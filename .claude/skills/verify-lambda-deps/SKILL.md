---
name: verify-lambda-deps
description: Verify Node dependencies resolve from the packaged Lambda after a change to the SSR dependency graph.
---

# Verify Lambda dependencies

Run the production build and invoke the packaged handler:

```bash
npm run test:deploy
```

esbuild checks the output for unexpected external imports. The smoke test copies
the Lambda outside the repo and exercises Googlebot SSR, which surfaces server
errors browsers can recover from. Set TEST_REDIS_URL to disposable local Redis to
also check the health check and chess lobby.

For a route outside the smoke test, use a Googlebot request against the Architect
sandbox or a staged deployment. Confirm both the HTTP status and the rendered
content. Only the runtime-provided SNS SDK and browser-only dynamic imports are
exempt from bundling.
