# 23 — Opt into React Router's v8 behaviours one at a time

|            |              |
| ---------- | ------------ |
| Finding    | D3           |
| Needs      | Repo only    |
| Risk       | Medium. Each flag changes framework behaviour. |
| Size       | 1 to 2 days in total; one flag per PR |
| Depends on | 08 (the post-deploy check makes this much safer) |

## Why

Every build prints five warnings:

```
Future Flag Warning: Route middleware support is changing … future.v8_middleware
Future Flag Warning: Route module splitting behavior is changing … future.v8_splitRouteModules
Future Flag Warning: Vite Environment API usage is changing … future.v8_viteEnvironmentApi
Future Flag Warning: Request handling behavior is changing … future.v8_passThroughRequests
Future Flag Warning: Data request URL formats are changing … future.v8_trailingSlashAwareDataRequests
```

React Router 8 is released, but this site cannot move to it yet: its AWS adapter, `@ballatech/react-router7-preset-aws`, requires version 7. Turning the flags on in version 7, one at a time, is the way to do most of the migration now, in small reversible steps.

## How

Flags go in `react-router.config.ts`:

```ts
export default {
  // …existing options
  future: { v8_splitRouteModules: true },
} satisfies Config;
```

For each flag, in this order (least to most invasive):

1. `v8_trailingSlashAwareDataRequests`
2. `v8_splitRouteModules`
3. `v8_passThroughRequests`
4. `v8_middleware`
5. `v8_viteEnvironmentApi`

do the following:

- Read that flag's section at `https://reactrouter.com/v7/upgrading/future` first. Do not guess what it changes.
- Turn on that one flag only.
- `npm run lint && npm run typecheck && npm test && npm run build:arc && npm run check:lambda-deps`.
- Compare the server-rendered HTML of `/`, one blog post and one chess page before and after, as a browser and as a bot user agent.
- Run through the site in a browser against the production build: client-side navigation between posts, a Multiple Choice Chess game, the Maia page (which forces a full page load on entry; see `app/routes/maiaDrills.tsx`), and a 404.
- One PR per flag, `chore: …`. If a flag needs code changes, they go in the same PR.

## Flag-specific cautions

- **`v8_splitRouteModules`** splits `clientLoader` and friends into separate chunks. Two routes rely on `clientLoader` behaviour: `app/routes/blog.$slug.tsx` (loads the post's chunk before navigating) and `app/routes/maiaDrills.tsx` (turns client navigation into a full page load; a regression there is a reload loop, which `tests/utils/pageCache.test.ts` only partly guards). Test both by hand.
- **`v8_trailingSlashAwareDataRequests`** changes the URLs of `.data` requests. If task 05 is done, those URLs are cache keys at CloudFront; invalidate after deploying (the deploy does this).
- **`v8_passThroughRequests`** changes what `request` a loader sees. `app/entry.server.tsx` builds the Content-Security-Policy from `new URL(request.url).pathname`; `app/utils/csp.server.ts` matches `/marginal-maia-mentor` exactly. Confirm the Maia page still gets `'unsafe-eval'` and others do not (`tests/utils/csp.test.ts` covers the function, not the wiring).
- **`v8_viteEnvironmentApi`** changes how the server build is produced. `scripts/check-lambda-deps.mjs` reads `server/build/server/`; `ssr.noExternal` in `vite.config.ts` controls what is bundled. Expect to adjust config. Do this one last, on its own.
- **`v8_middleware`** is only needed if something uses middleware. Turning it on changes the `context` type passed to loaders; the code passes `{}` from `server.ts`.

## Stop and ask if

A flag is incompatible with `@ballatech/react-router7-preset-aws`. Report the error; do not patch the adapter.

## Done when

The build prints no future-flag warnings, or each remaining one has a recorded reason.
