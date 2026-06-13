// Local closed-loop check for the giscus theme's light-mode cascade.
//
// giscus.app is not reachable from CI/sandboxes, so instead of loading the real
// widget this reconstructs the relevant slice of giscus' own DOM + CSS:
//   - a <main> whose background is painted from var(--color-canvas-default)
//   - a giscus-style DARK default for that var declared directly on <main>
//   - a transparent html/body (giscus blends into the host page)
// then layers OUR theme CSS on top and renders under emulated iOS dark mode.
// It asserts the computed background of html/body/main is white — i.e. our
// override actually wins the cascade and the iframe backdrop is forced light.
//
// This validates the cascade + color-scheme logic, which is the thing that was
// wrong. It does NOT exercise the real giscus.app (egress-blocked here); verify
// the deployed widget on-device after shipping.
import fs from "node:fs";
import { chromium } from "playwright-core";

const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const THEME_FILE = new URL("../app/routes/giscus-theme[.]css.ts", import.meta.url);

function readThemeCss() {
  const src = fs.readFileSync(THEME_FILE, "utf8");
  const m = src.match(/const THEME_CSS = `([\s\S]*?)`;/);
  if (!m) throw new Error("Could not extract THEME_CSS from route file");
  return m[1];
}

// Mimic giscus' base styling: page surface comes from --color-canvas-default on
// <main>, with a DARK default declared on main (the worst case for our override).
const GISCUS_BASE_CSS = `
  html, body { margin: 0; background: transparent; }
  main {
    --color-canvas-default: #0d1117;   /* giscus dark default, on main */
    --color-fg-default: #e6edf3;
    background-color: var(--color-canvas-default);
    color: var(--color-fg-default);
    min-height: 100vh;
    padding: 16px;
  }
  .gsc-comment-box { border: 1px solid var(--color-border-default, #30363d); padding: 12px; }
`;

const html = (themeCss) => `<!doctype html><html><head>
<style>${GISCUS_BASE_CSS}</style>
<style id="theme">${themeCss}</style>
</head><body><main>
  <div class="gsc-reactions">0 reactions</div>
  <div class="gsc-comment-box">Sign in to comment</div>
</main></body></html>`;

const browser = await chromium.launch({ executablePath: CHROME });
const context = await browser.newContext({
  colorScheme: "dark",
  viewport: { width: 390, height: 844 },
});
const page = await context.newPage();
await page.setContent(html(readThemeCss()), { waitUntil: "load" });

const probe = await page.evaluate(() => {
  const pick = (sel) => {
    const el = sel === ":root" ? document.documentElement : document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { bg: cs.backgroundColor, color: cs.color, colorScheme: cs.colorScheme };
  };
  return { html: pick(":root"), body: pick("body"), main: pick("main") };
});

const WHITE = "rgb(255, 255, 255)";
const ok = probe.main.bg === WHITE && probe.body.bg === WHITE;

console.log("computed styles under emulated iOS dark mode:");
console.log(JSON.stringify(probe, null, 2));
await page.screenshot({ path: "/tmp/giscus-check.png" });
console.log(`\nmain background = ${probe.main.bg}`);
console.log(ok ? "PASS: surface is white" : "FAIL: surface is not white");

await browser.close();
process.exit(ok ? 0 : 1);
