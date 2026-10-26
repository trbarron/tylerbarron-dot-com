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
