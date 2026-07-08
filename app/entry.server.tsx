/**
 * By default, Remix will handle generating the HTTP Response for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.server
 */

import { PassThrough, Readable } from "node:stream";

import type { AppLoadContext, EntryContext } from "react-router";
import { ServerRouter } from "react-router";
import { isbot } from "isbot";
import { renderToPipeableStream } from "react-dom/server";

const ABORT_DELAY = 5_000;

// Security headers for document responses. Static assets are served from the
// CDN bucket and don't pass through here, but headers only matter on documents.
//
// CSP caveats, all load-bearing:
// - 'unsafe-eval': blog posts evaluate compiled MDX via `new Function` at
//   runtime, and Stockfish compiles WASM (blog.$slug.tsx, stockfishEngine.ts).
// - 'unsafe-inline': React Router's hydration script and the gtag bootstrap
//   are inline. Tightening to nonces would require plumbing one through
//   root.tsx and this file.
// - blob: workers: Stockfish bootstraps from a Blob URL (it importScripts the
//   unpkg-hosted engine), and Timer.tsx uses a blob worker.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://www.googletagmanager.com https://unpkg.com https://giscus.app",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.googletagmanager.com https://*.google-analytics.com",
  "font-src 'self'",
  [
    "connect-src 'self' blob:",
    // Google Analytics (incl. regional endpoints)
    "https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
    // Stockfish engine + WASM (multiple choice chess)
    "https://unpkg.com",
    // Cat tracker camera + chesser guesser puzzle APIs
    "https://nj3ho46btl.execute-api.us-west-2.amazonaws.com https://f73vgbj1jk.execute-api.us-west-2.amazonaws.com",
    // Pizza map datasets (S3) + US state boundaries (jsdelivr)
    "https://externalwebsiteassets.s3.us-west-2.amazonaws.com https://cdn.jsdelivr.net",
    // Collaborative checkmate game server (REST lobby + websocket gameplay)
    "https://collaborative-checkmate-server.fly.dev wss://collaborative-checkmate-server.fly.dev",
  ].join(" "),
  "media-src 'self'",
  "frame-src https://www.youtube.com https://giscus.app",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

function applySecurityHeaders(headers: Headers) {
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  // This is ignored so we can keep it in the template for visibility.  Feel
  // free to delete this parameter in your app if you're not using it!
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  loadContext: AppLoadContext
) {
  return isbot(request.headers.get("user-agent") || "")
    ? handleBotRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext
      )
    : handleBrowserRequest(
        request,
        responseStatusCode,
        responseHeaders,
        remixContext
      );
}

function handleBotRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={remixContext}
        url={request.url}
      />,
      {
        onAllReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = Readable.toWeb(body) as ReadableStream;

          responseHeaders.set("Content-Type", "text/html");
          applySecurityHeaders(responseHeaders);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}

function handleBrowserRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext
) {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const { pipe, abort } = renderToPipeableStream(
      <ServerRouter
        context={remixContext}
        url={request.url}
      />,
      {
        onShellReady() {
          shellRendered = true;
          const body = new PassThrough();
          const stream = Readable.toWeb(body) as ReadableStream;

          responseHeaders.set("Content-Type", "text/html");
          applySecurityHeaders(responseHeaders);

          resolve(
            new Response(stream, {
              headers: responseHeaders,
              status: responseStatusCode,
            })
          );

          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          // Log streaming rendering errors from inside the shell.  Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            console.error(error);
          }
        },
      }
    );

    setTimeout(abort, ABORT_DELAY);
  });
}
