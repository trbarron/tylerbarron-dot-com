# 10 — Tag a release only after the build exists

|            |                 |
| ---------- | --------------- |
| Finding    | D1 (remainder)  |
| Needs      | Repo only       |
| Risk       | Medium. Changes the release step of the deploy workflow; can only be fully tested by a real deploy. |
| Size       | 2 to 3 hours    |
| Depends on | Nothing         |

## Why

In `.github/workflows/deploy.yml`, the `deploy` job runs `npx semantic-release` **before** `npm run build:arc`. semantic-release bumps `package.json`, commits, tags and pushes. If the build, the S3 sync or `arc deploy` then fails, `master` carries a tagged version that never deployed. `docs/deployment.md` ("Versioning") describes one such incident.

The build has to come after the version bump because the footer shows the version: `vite.config.ts` reads `package.json` and injects `__APP_VERSION__`.

## The change

Split semantic-release into "work out the next version" and "publish it":

1. Early in the job, compute the next version without changing anything:

   ```bash
   npx semantic-release --dry-run --no-ci
   ```

   Parse the next version from its output (`The next release version is X.Y.Z`), or write a few lines of Node using semantic-release's JavaScript API with `dryRun: true`, which returns `nextRelease.version`. No release-worthy commits means no version: keep the current one.

2. Make the build use that version. Simplest: have `vite.config.ts` prefer an environment variable and fall back to `package.json`:

   ```ts
   __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? pkg.version),
   ```

   and pass `APP_VERSION` to the `🏗 Build` step.

3. Build, publish assets, `arc deploy` as now.

4. Only after `🚀 Production Deploy` succeeds, run the real `npx semantic-release`, then the existing non-blocking `🏷 GitHub Release` step.

## Things that must keep working

- The release commit message keeps `[skip ci]`, or the push re-triggers the workflow.
- `package.json` on `master` ends up with the same version the footer shows. Check this explicitly on the first deploy.
- A push with no release-worthy commits (`chore:`, `docs:`, `ci:`) still deploys, with the version unchanged.
- The checkout keeps `fetch-depth: 0`; semantic-release needs tags and history.
- `HUSKY: 0` stays set, so the commit hook does not run on the release commit.

## Verify

- `npm run lint`, `npm run typecheck`, `npm run format:check`, `npm test`, `npm run build`.
- Locally: `GITHUB_TOKEN=<token> npx semantic-release --dry-run --no-ci` prints a next version when a `fix:` or `feat:` commit is pending.
- After merging: the deploy run shows the build before the tag push, the footer on the live site shows the new version, and `git tag --points-at origin/master` matches it.

Update the "Versioning" section of `docs/deployment.md` to describe the new order. Commit as `ci: …`.

## Done when

A deliberately failing build (try it on a throwaway branch with `workflow_dispatch`, or reason it through with the owner) leaves no new tag, and a normal deploy still tags and shows the right version.
