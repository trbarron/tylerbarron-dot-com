# 13 — One image tree, deployed by CI

Implementation is prepared locally:

- All 47 project images moved to `public/images/<Project>/`, preserving bytes, case and URLs.
- Removed the manual upload script, its npm command, unused S3 client dependency and unused image helpers.
- CI uploads ordinary images with a one-day TTL; models, pizza data and project cards retain their one-hour TTL.
- Guidance and operational notes updated. Existing bucket metadata was not rewritten.

## Verified locally

Lint, typecheck, formatting, 579 tests, production build, Lambda assembly/import checks
and OG references passed. Nineteen real-Redis tests skipped without a Redis URL.
All 47 moved files are byte-identical to Git originals and production build copies.
All six affected pages returned 200 locally; rendered image URLs loaded, and every
moved image URL returned its original bytes.

## After deployment

Check `/SSBM`, `/set`, `/the-riddler`, `/generative-art`, `/camel-up-cup/2018`
and `/cat-tracker/blog` for image failures. Confirm the normal deploy uploads project
images without a separate command. Existing immutable browser caches need a new
filename for replacements that must be visible immediately.

Then close the task in the audit index and remove this checklist. Lasting details
are in `docs/deployment.md`.
