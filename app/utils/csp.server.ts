// The Content-Security-Policy sent with every document.
//
// Caveats, all load-bearing:
// - 'unsafe-inline': React Router's hydration script and the gtag bootstrap
//   are inline. Tightening to nonces would require plumbing one through
//   root.tsx and entry.server.tsx, and would stop pages being cached at the edge.
// - 'wasm-unsafe-eval': Stockfish and onnxruntime-web compile WASM. It allows
//   that and nothing else: no eval(), no new Function().
// - 'unsafe-eval', on the Maia page only: onnxruntime-web's WebGPU build
//   generates functions with `new Function`, in a worker that inherits the
//   policy of the document that started it. See EVAL_PAGES.
// - blob: workers: Stockfish bootstraps from a Blob URL (it importScripts the
//   unpkg-hosted engine), and Timer.tsx uses a blob worker. Maia Drills' worker
//   does the same with onnxruntime-web from jsDelivr, which then imports its
//   own .mjs loader from there, hence jsDelivr in script-src.

/**
 * Pages whose document is allowed eval. A policy belongs to a document, not a
 * URL, so a page listed here must only ever be entered with a full page load:
 * arriving by client-side navigation would keep the previous page's stricter
 * policy and the engine would fail. The Maia route forces that itself (its
 * clientLoader), so no link to it needs special care.
 */
const EVAL_PAGES = new Set(['/marginal-maia-mentor']);

export function allowsEval(pathname: string): boolean {
  // Route matching ignores case and a trailing slash, so this does too.
  return EVAL_PAGES.has(pathname.toLowerCase().replace(/\/+$/, ''));
}

export function contentSecurityPolicy(pathname: string): string {
  const evalGrant = allowsEval(pathname) ? "'unsafe-eval'" : "'wasm-unsafe-eval'";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${evalGrant} blob: https://www.googletagmanager.com https://unpkg.com https://cdn.jsdelivr.net https://giscus.app`,
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com",
    "font-src 'self'",
    [
      "connect-src 'self' blob:",
      // Google Analytics (incl. regional endpoints)
      'https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com',
      // Stockfish engine + WASM (multiple choice chess)
      'https://unpkg.com',
      // Cat tracker camera + chesser guesser puzzle APIs
      'https://nj3ho46btl.execute-api.us-west-2.amazonaws.com https://f73vgbj1jk.execute-api.us-west-2.amazonaws.com',
      // US state boundaries for the pizza map (jsdelivr). The pizza datasets
      // themselves are same-origin now (/images/pizza/*), so they need no grant.
      'https://cdn.jsdelivr.net',
      // Maia Drills: players' games, and the Maia model. Hugging Face answers
      // the model URL with a redirect to its storage CDN on *.hf.co.
      'https://lichess.org https://api.chess.com https://huggingface.co https://*.hf.co',
    ].join(' '),
    "media-src 'self'",
    'frame-src https://www.youtube.com https://giscus.app',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
