import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { isTrustedOrigin } from './app/utils/origin.server';
import { SITE_URL } from './app/utils/seo';

import { createRequestHandler } from '@ballatech/react-router7-preset-aws';

const mode = process.env.ARC_ENV === 'testing' || process.env.ARC_ENV === 'staging' ? 'development' : 'production';

const productionHost = new URL(SITE_URL).host;

const requestHandler = createRequestHandler({
  // @ts-expect-error - React Router build types
  build: () => import('./build/server/index.mjs'),
  mode: mode,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlerFn(event: any, context: any) {
  if (!isTrustedOrigin(event.headers)) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      body: 'Forbidden',
    };
  }
  const production = process.env.ARC_ENV === 'production';
  if (production) {
    if (
      typeof event.rawPath !== 'string' ||
      !event.rawPath.startsWith('/') ||
      typeof event.rawQueryString !== 'string'
    ) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        body: 'Bad Request',
      };
    }

    // The adapter prefers X-Forwarded-Host, which CloudFront forwards from viewers.
    const headers = Object.fromEntries(
      Object.entries(event.headers).filter(([name]) => !['host', 'x-forwarded-host'].includes(name.toLowerCase())),
    );
    event = { ...event, headers: { ...headers, host: productionHost } };
  }

  const path = event.rawPath || event.path || event.requestContext?.http?.path;

  // Serve static files in the local arc sandbox only.
  // In production all assets are served from the CDN (VITE_CDN_URL baked into
  // the Vite build at compile time), so the Lambda never sees /assets/ requests.
  if (!production && (path?.startsWith('/assets/') || path?.startsWith('/fonts/') || path?.startsWith('/images/'))) {
    // The client build: hashed assets plus a copy of public/ (fonts, images).
    const clientDir = join(process.cwd(), '..', 'build', 'client');
    const filePath = join(clientDir, path);

    if (existsSync(filePath)) {
      const content = readFileSync(filePath);
      const ext = filePath.split('.').pop();
      const mimeTypes: Record<string, string> = {
        js: 'application/javascript',
        css: 'text/css',
        // /images/pizza/*.json — fetched by PizzaScoringMap in the sandbox.
        json: 'application/json',
        jpg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        svg: 'image/svg+xml',
        woff: 'font/woff',
        woff2: 'font/woff2',
        mp4: 'video/mp4',
        webm: 'video/webm',
      };
      return {
        statusCode: 200,
        headers: {
          'Content-Type': mimeTypes[ext || ''] || 'application/octet-stream',
        },
        body: content.toString('base64'),
        isBase64Encoded: true,
      };
    }
  }

  // @ts-expect-error - AWS Lambda context type mismatch with React Router adapter
  return requestHandler(event, context, {});
}

export const handler = handlerFn;
