// CRITICAL: Set NODE_ENV BEFORE any imports
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = process.env.ARC_ENV === 'testing' ? 'development' : 
                         process.env.ARC_ENV === 'staging' ? 'staging' : 
                         'production';
}

// Log environment on cold start
console.log('[LAMBDA INIT] Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  ARC_ENV: process.env.ARC_ENV,
  ARC_SANDBOX: process.env.ARC_SANDBOX,
  AWS_EXECUTION_ENV: process.env.AWS_EXECUTION_ENV,
});

import { readFileSync, existsSync } from "fs";
import { join } from "path";

// WORKAROUND: React Router 7's package.json always points to development build
// Import the adapter which will internally import react-router
// The adapter's mode parameter should handle dev vs prod behavior
import { createRequestHandler } from "@ballatech/react-router7-preset-aws";

// Explicitly set mode - the adapter defaults to NODE_ENV, but let's be explicit
const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development';
console.log('[LAMBDA INIT] Creating request handler with mode:', mode);

const requestHandler = createRequestHandler({
  // @ts-expect-error - React Router build types
  build: () => import("./build/server/root/index.mjs"),
  mode: mode,
  getLoadContext() {
    return {};
  },
});

// Log that initialization is complete
console.log('[LAMBDA INIT] Handler initialized successfully');

async function handlerFn(event, context) {
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
    
    const response = await requestHandler(event, context);
    return response;
  } catch (error) {
    console.error('Handler error:', error);
    throw error;
  }
}

export const handler = handlerFn;