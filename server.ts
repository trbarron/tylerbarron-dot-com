// CRITICAL: Set NODE_ENV BEFORE any imports
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = process.env.ARC_ENV === 'testing' ? 'development' : 
                         process.env.ARC_ENV === 'staging' ? 'staging' : 
                         'production';
}

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// WORKAROUND: React Router 7's package.json always points to development build
// Import the adapter which will internally import react-router
// The adapter's mode parameter should handle dev vs prod behavior
import { createRequestHandler } from "@ballatech/react-router7-preset-aws";

// Explicitly set mode - the adapter defaults to NODE_ENV, but let's be explicit
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';

const requestHandler = createRequestHandler({
  // @ts-expect-error - React Router build types
  build: () => import("./build/server/root/index.mjs"),
  mode: mode,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handlerFn(event: any, context: any) {
  try {
    // In local dev, serve static files from public directory
    const path = event.rawPath || event.path || event.requestContext?.http?.path;
    
    // Serve static files in all environments when using spa mode
    // In production, files are in build/client/, in dev they're in ../public/
    if (path?.startsWith('/assets/') || path?.startsWith('/fonts/') || path?.startsWith('/images/')) {
      const isProduction = process.env.ARC_ENV === 'production';
      const publicDir = isProduction 
        ? join(process.cwd(), 'build', 'client')
        : join(process.cwd(), '..', 'public');
      const filePath = join(publicDir, path);
      
      if (existsSync(filePath)) {
        const content = readFileSync(filePath);
        const ext = filePath.split('.').pop();
        const mimeTypes: Record<string, string> = {
          'js': 'application/javascript',
          'css': 'text/css',
          'jpg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'svg': 'image/svg+xml',
          'woff': 'font/woff',
          'woff2': 'font/woff2',
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
    const response = await requestHandler(event, context, {});
    return response;
  } catch (error) {
    console.error('Handler error:', error);
    throw error;
  }
}

export const handler = handlerFn;