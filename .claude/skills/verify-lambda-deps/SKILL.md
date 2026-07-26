---
name: verify-lambda-deps
description: Verify every npm package the SSR build imports is installed in the Lambda. Use after a build that added, moved, or changed an import reachable from a route/component that server-renders, before deploying. Catches the failure mode where routes 500 for bots and curl but look fine in a browser.
---

# Verify Lambda dependencies

The Vite SSR build **externalizes all npm deps** — it emits bare `from "pkg"` specifiers
and expects them present at runtime. The Lambda only installs `server/package.json`, a
hand-maintained list separate from the root `package.json`. Nothing checks these agree.

When they disagree the route throws on the server. React Router's `onAllReady` path —
used for bots and curl — gets nothing and returns 500. Browsers take the `onShellReady`
path and recover client-side, so **the breakage is invisible unless you test without a
browser**. This shipped once already (2026-06-10).

## Procedure

Run against a current build (`npm run build` first if `build/server/` is stale):

```bash
grep -rho 'from "[^"]*"' build/server/ | grep -v '"\./\|"node:' | sort -u
```

That is every external specifier the SSR bundle expects — plus some noise. Compiled MDX
is minified into the same chunks, so prose containing `from "…"` shows up as garbage
lines like `,(0,e.jsx)(t.a,{href:`. Ignore anything that isn't a plausible package name;
don't try to tighten the grep until it's clean, because a too-clever filter is how you
miss a real import. For each one, resolve the
package name (scoped names keep two segments: `@scope/pkg`; subpaths drop to the package
root, so `react-dom/server` → `react-dom`) and confirm it is satisfied by one of:

1. **`server/package.json` dependencies** — the packages actually installed in the Lambda.
2. **`ssr.noExternal` in `vite.config.ts`** — currently `chessground`, `d3-geo`,
   `d3-array`, `topojson-client`. These get bundled into `build/server` instead of being
   imported at runtime, so they must *not* also be in `server/package.json`.
3. **A transitive peer npm installs on its own** — `react-router` and
   `@react-router/node` come in via the AWS preset. Treat these as satisfied only if you
   can point at the parent that pulls them.

Anything left over is the bug. Report it as: the specifier, the chunk importing it, and
which of the two fixes applies.

## Choosing the fix

- **Small, or needed at runtime** → add it to `server/package.json`.
- **Large, tree-shakeable, or pulls a heavy tree** → add it to `ssr.noExternal` so it
  bundles instead. The Lambda is already ~15 MB installed, dominated by `react-dom`
  (4.4 MB) and `react-router` (4 MB); every runtime dep is cold-start cost.

`@aws-sdk/client-lambda` belongs in the Lambda — `app/utils/camelUpCup/tournament.server.ts`
invokes the tournament Lambda at runtime. Don't "clean it up". No *other* AWS SDK
package should ship: `@aws-sdk/client-s3` is used only by the upload scripts and stays a
devDependency. Both are devDependencies in the root `package.json`, so root membership
proves nothing either way — `server/package.json` is the authority.

## Confirming the fix

A browser is not a valid test — it masks this class of failure. Request the affected
route the way a bot would and confirm a 200 with real HTML in the body:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -A 'Googlebot' <url>
```

Locally that means building and running `npm start` rather than `npm run dev`; the dev
server does not reproduce the externalization boundary.
