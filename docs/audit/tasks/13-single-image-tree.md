# 13 — One image tree, deployed by CI

|            |                                             |
| ---------- | ------------------------------------------- |
| Finding    | D7, D8                                      |
| Needs      | Repo change; AWS read access to check the bucket first |
| Risk       | Medium. A wrong path gives broken images in production only. |
| Size       | Half a day                                  |
| Depends on | Nothing                                     |

## Why

There are two homes for images:

- `public/images/…` is synced to the asset bucket by the deploy workflow.
- `app/images/<Project>/…` (about 4 MB: `CamelUpCup`, `CatTracker`, `ChesserGuesser`, `GenerativeArt`, `Global`, `Riddler`, `SSBM`, `Set`) reaches the bucket only when someone runs `npm run deploy:images` (`scripts/upload-images-to-s3.mjs`) by hand.

Components reference the second kind through `getImageUrl('SSBM/falco1.jpg')` in `app/utils/cdn.ts`, which resolves to `/images/SSBM/falco1.jpg`. So a new project image that is committed but not uploaded works in dev and 404s in production, and nothing in CI notices.

## Step 1 — Confirm the bucket matches the repo (read-only)

Before moving anything, confirm the files are in the bucket at the keys the code expects. The bucket name is the repository secret `AWS_BUCKET_NAME`; the upload script's default suggests `remix-website-writing-posts`, but confirm with the owner or from the CloudFront origin (`aws cloudfront get-distribution-config --id E1TUWNZL0WZZ6J --query 'DistributionConfig.Origins.Items[].DomainName'`).

```bash
for d in CamelUpCup CatTracker ChesserGuesser GenerativeArt Global Riddler SSBM Set; do
  echo "$d: repo $(find app/images/$d -type f | wc -l), bucket $(aws s3 ls "s3://<bucket>/images/$d/" --recursive | wc -l)"
done
```

Report any directory where the counts differ. A file in the repo but not the bucket is a broken image on the live site today.

## Step 2 — Move the files

```bash
git mv app/images/* public/images/
```

The URLs do not change: `getImageUrl('SSBM/falco1.jpg')` still resolves to `/images/SSBM/falco1.jpg`, which is where the file now lives in `public/`.

Then check each of these still works:

- **Dev**: `npm run dev`, open `/SSBM`, `/set`, `/the-riddler`, `/generative-art`, `/camel-up-cup/2018`, `/cat-tracker/blog`. Images load.
- **Anything that imported from `app/images` directly** rather than through `getImageUrl`: `grep -rn "images/" app --include=*.tsx --include=*.ts | grep -E "from |import\("`. Fix those imports.
- **`CLAUDE.md`** says app images live in `app/images/<Project>/`. Update that bullet (and `AGENT.md` and `AGENTS.md`, which are copies).
- **`scripts/check-og-images.mjs`** validates image references and case. Run `npm run check:og`.
- **Case sensitivity**: S3 is case-sensitive and macOS is not. The directory is `SSBM`, not `ssbm`. Do not rename anything.

## Step 3 — Remove the manual path

- Delete `scripts/upload-images-to-s3.mjs` and the `deploy:images` script in `package.json`.
- `@aws-sdk/client-s3` is then unused; remove it (`npm uninstall @aws-sdk/client-s3`) after confirming with `grep -rn "client-s3" scripts app`.
- Simplify `app/utils/cdn.ts`: `getResponsiveSrcSet`, `getModernImageSources`, `preloadImage` and `image()` have no callers and two of them build URLs for files that do not exist. Delete them and their tests if any.

## Step 4 — The cache header (D8)

The workflow uploads everything under `/images/*`, except four excluded folders, with `max-age=31536000, immutable` under fixed filenames. Replacing an image in place never reaches anyone who has already seen it.

Pick one and implement it in `.github/workflows/deploy.yml`:

- **Simplest:** change the default for `/images/*` to `public,max-age=86400` and delete the four special-case syncs that exist only to avoid `immutable`. Images are then re-checked once a day.
- **Keep it as is, and enforce it:** add a CI check that fails when a file under `public/images/` is modified rather than added.

The first is recommended. Note that objects already in the bucket keep their old header until re-uploaded; `aws s3 sync` does not re-upload unchanged files. A one-off `aws s3 cp --recursive --metadata-directive REPLACE --cache-control …` on the prefix fixes existing objects; that is an AWS write, so get the owner's go-ahead.

## Verify

`npm run lint && npm run typecheck && npm run format:check && npm test && npm run build && npm run check:og`. After the deploy, load each page listed in step 2 on the live site and confirm no image 404s (browser network tab, or `curl -sI` a handful of image URLs).

Commit as `refactor: …` for the move (no release) and `ci: …` for the workflow.

## Done when

`app/images/` no longer exists, there is no manual upload script, and a new image under `public/images/` reaches production through a normal deploy.
