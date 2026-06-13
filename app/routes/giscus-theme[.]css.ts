// Custom giscus theme — brutalist black/white to match the site. giscus fetches
// this from inside its cross-origin iframe, so it must be served with CORS.
// Pointed at via Giscus.tsx's data-theme (the page's own origin + this path).
// Forks Primer's light theme (https://github.com/giscus/giscus styles/themes/light.css),
// overriding the structural color variables and squaring off borders/shadows.
const THEME_CSS = `
:root {
  color-scheme: light;

  /* syntax highlighting — Primer light defaults */
  --color-prettylights-syntax-comment: #6e7781;
  --color-prettylights-syntax-constant: #0550ae;
  --color-prettylights-syntax-entity: #8250df;
  --color-prettylights-syntax-storage-modifier-import: #24292f;
  --color-prettylights-syntax-entity-tag: #116329;
  --color-prettylights-syntax-keyword: #cf222e;
  --color-prettylights-syntax-string: #0a3069;
  --color-prettylights-syntax-variable: #953800;
  --color-prettylights-syntax-brackethighlighter-unmatched: #82071e;
  --color-prettylights-syntax-invalid-illegal-text: #f6f8fa;
  --color-prettylights-syntax-invalid-illegal-bg: #82071e;
  --color-prettylights-syntax-carriage-return-text: #f6f8fa;
  --color-prettylights-syntax-carriage-return-bg: #cf222e;
  --color-prettylights-syntax-string-regexp: #116329;
  --color-prettylights-syntax-markup-list: #3b2300;
  --color-prettylights-syntax-markup-heading: #0550ae;
  --color-prettylights-syntax-markup-italic: #24292f;
  --color-prettylights-syntax-markup-bold: #24292f;
  --color-prettylights-syntax-markup-deleted-text: #82071e;
  --color-prettylights-syntax-markup-deleted-bg: #ffebe9;
  --color-prettylights-syntax-markup-inserted-text: #116329;
  --color-prettylights-syntax-markup-inserted-bg: #dafbe1;
  --color-prettylights-syntax-markup-changed-text: #953800;
  --color-prettylights-syntax-markup-changed-bg: #ffd8b5;
  --color-prettylights-syntax-markup-ignored-text: #eaeef2;
  --color-prettylights-syntax-markup-ignored-bg: #0550ae;
  --color-prettylights-syntax-meta-diff-range: #8250df;
  --color-prettylights-syntax-brackethighlighter-angle: #57606a;
  --color-prettylights-syntax-sublimelinter-gutter-mark: #8c959f;
  --color-prettylights-syntax-constant-other-reference-link: #0a3069;

  /* buttons — default = white/black/hard border, primary = black */
  --color-btn-text: #171717;
  --color-btn-bg: #ffffff;
  --color-btn-border: #000000;
  --color-btn-shadow: none;
  --color-btn-inset-shadow: none;
  --color-btn-hover-bg: #f0f0f0;
  --color-btn-hover-border: #000000;
  --color-btn-active-bg: #e5e5e5;
  --color-btn-active-border: #000000;
  --color-btn-selected-bg: #e5e5e5;
  --color-btn-primary-text: #ffffff;
  --color-btn-primary-bg: #171717;
  --color-btn-primary-border: #000000;
  --color-btn-primary-shadow: none;
  --color-btn-primary-inset-shadow: none;
  --color-btn-primary-hover-bg: #000000;
  --color-btn-primary-hover-border: #000000;
  --color-btn-primary-selected-bg: #000000;
  --color-btn-primary-disabled-text: rgb(255 255 255 / 70%);
  --color-btn-primary-disabled-bg: #9a9a9a;
  --color-btn-primary-disabled-border: #000000;

  --color-segmented-control-bg: #f0f0f0;
  --color-segmented-control-button-bg: #ffffff;
  --color-segmented-control-button-selected-border: #000000;

  /* surfaces + text */
  --color-fg-default: #171717;
  --color-fg-muted: #444444;
  --color-fg-subtle: #666666;
  --color-canvas-default: #ffffff;
  --color-canvas-overlay: #ffffff;
  --color-canvas-inset: #f5f5f5;
  --color-canvas-subtle: #f5f5f5;
  --color-border-default: #000000;
  --color-border-muted: #000000;
  --color-neutral-muted: rgb(0 0 0 / 8%);
  --color-accent-fg: #171717;
  --color-accent-emphasis: #171717;
  --color-accent-muted: rgb(0 0 0 / 30%);
  --color-accent-subtle: #f0f0f0;
  --color-success-fg: #1a7f37;
  --color-attention-fg: #9a6700;
  --color-attention-muted: rgb(212 167 44 / 40%);
  --color-attention-subtle: #fff8c5;
  --color-danger-fg: #d1242f;
  --color-danger-muted: rgb(255 129 130 / 40%);
  --color-danger-subtle: #ffebe9;
  --color-primer-shadow-inset: none;
  --color-scale-gray-1: #eaeef2;
  --color-scale-blue-1: #b6e3ff;
  --color-social-reaction-bg-hover: #f0f0f0;
  --color-social-reaction-bg-reacted-hover: #e5e5e5;
}

html, body {
  background-color: #ffffff !important;
  color: #171717 !important;
}

main {
  font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif;
}

main .pagination-loader-container {
  background-image: url("https://github.com/images/modules/pulls/progressive-disclosure-line.svg");
}
main .gsc-loading-image {
  background-image: url("https://github.githubassets.com/images/mona-loading-default.gif");
}

/* Brutalist structure: square off corners, hard 2px black borders, no shadows. */
main .gsc-comment-box,
main .gsc-comment > div,
main .gsc-reactions,
main .gsc-comment-content,
main textarea,
main input,
main .btn,
main .BtnGroup,
main .form-control,
main .color-bg-subtle,
main .gsc-comment-box-tabs {
  border-radius: 0 !important;
}
main .btn,
main .gsc-comment-box,
main .gsc-comment > div {
  border-width: 2px !important;
  box-shadow: none !important;
}
`;

export function loader() {
  return new Response(THEME_CSS, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      // giscus fetches this from its own (giscus.app) origin.
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
