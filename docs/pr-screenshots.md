# PR screenshots

`npm run pr-screenshots -- --route /runescape-rascals` compares production with this checkout at desktop and phone widths. It waits for the configured ready element, webfonts and images; HTTP failures, broken images and browser exceptions fail the capture instead of posting misleading evidence. Fonts, images and focus panels are prepared before capture; CSS animations and carets are disabled.

By default, the comment shows matching before/after crops around visual differences, with 24px of context. Distant changes become separate pairs; crops are limited to 800px tall. Small channel differences (24/255 or less) are ignored. Identical pages report no detected differences. Full pages stay in a collapsed section for context. `--full-page` restores full-page comparisons; `--focus <selector>` overrides automatic cropping when a specific panel is the subject of the change. Crops use matching page coordinates, so layout shifts may produce several regions. On live dashboards, use fixtures or `--focus` to avoid unrelated data changes.

The tool starts a development server on the `--local` port and cleans up its browser and owned server on success, failure or interruption. It refuses to reuse an occupied address unless `--reuse-server` is supplied. Verify that address serves this checkout before opting in. `--focus` opens ancestor `<details>` panels before cropping; `--open` adds an opened-panel image without closing one that focus already opened.

```sh
npm run pr-screenshots -- --route /runescape-rascals --local http://127.0.0.1:5197
npm run pr-screenshots -- --route /runescape-rascals --local http://localhost:5188 --reuse-server
```

For another repository, reuse `scripts/pr-screenshots.mjs`, `scripts/lib/pr-screenshots.mjs` and `scripts/lib/screenshot-diff.mjs`, install Playwright and Sharp, add the npm script, and supply `pr-screenshots.config.json`. The file defines production/local URLs, a server argument array, widths, an application readiness selector and the environment keys permitted from `--env-file`. `{port}` and `{hostname}` placeholders pass the selected local address to the server; no shell evaluation is used. Other frameworks can supply a different start command. `--config` selects another JSON file.

`--no-comment` only saves local files and needs no GitHub publication. Default publication supports public GitHub repositories: images go to an images-only branch, and one marked PR comment is updated. Private repositories need a different artifact destination before automatic image posting is useful. Environment variable values are never written to screenshot comments.

These are review images, not deterministic visual regression tests. Live data can change between production and branch captures. For stable pixel comparisons, each project should provide equivalent fixtures and authentication in its preview environment. `readySelector` should indicate actual application readiness, not just a loading shell.

## Capture every book-club state

```sh
npm run pr-screenshots -- --scenario book-club
```

This captures creation, joining, choosing votes, exhausted up/down allowances,
repeated votes and removal, ballot confirmation, locked-in
ballot, host dashboard, private-host-link disclosure, closing confirmation and
results. Every state gets desktop and phone comparisons in the same PR comment.
Use the usual `--local`, `--reuse-server`, `--widths`, `--out` and `--no-comment`
options. `--scenario` selects the route list instead of `--route`.

The suite uses the same **synthetic** API responses and local browser sessions for
production and the branch. It creates no Redis records, needs no real invite or
host links, and blocks writes to the fixture API. Fixtures include the legacy
host totals so comparisons can show their removal. This checks presentation and
browser interactions; the real-Redis tests still check backend behavior.

Add or update states in `scripts/fixtures/book-club.mjs`. Each state names a route,
readiness selector, optional local-storage session, synthetic API responses and
optional button clicks (for opening a modal) and enabled/disabled checks on the
branch. Each page gets a fresh browser
context, so state does not leak between captures. The script waits for the final
modal or disclosure before shooting. To support another feature, add its fixture
module and register its name in `captureScenarios()`; the capture and PR-comment
code are shared.

## Ignore changing values

The repository config's `maskSelectors` hides the footer version/commit line and
any element marked `data-screenshot-ignore`. Matching regions are painted white
in both captures before difference detection. Their layout space stays intact;
the live page is unchanged. Masks apply to full pages, focus, hover and opened
panels, including scenario captures. Missing matches are harmless.

Add masks for changing IDs, timestamps or other values as needed:

```sh
npm run pr-screenshots -- --route /book-club --mask '.timestamp' --mask '[data-hash]'
npm run pr-screenshots -- --route /book-club --no-masks
```

Repeated `--mask` selectors add to the configured defaults. A scenario can also
provide `maskSelectors`. Use `--no-masks` to inspect the actual values. Select a
stable container around a changing value (such as the full version line) so
differences in the value's text width do not create different-sized masks. Mask
only incidental data; keep labels and UI state visible for review.
