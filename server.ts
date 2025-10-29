// CRITICAL: Set NODE_ENV BEFORE any imports
// React Router uses Node.js conditional exports that resolve at import time
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

import { createRequestHandler } from "@ballatech/react-router7-preset-aws";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// The adapter will automatically use process.env.NODE_ENV for mode
const requestHandler = createRequestHandler({
  // @ts-expect-error - React Router build types
  build: () => import("./build/server/root/index.mjs"),
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
    
    // Only serve static files in Arc Sandbox (ARC_ENV='testing'), not production
    if (process.env.ARC_ENV === 'testing' && path?.startsWith('/assets/')) {
      // In Arc Sandbox, cwd is 'server/', so go up one level to find 'public/'
      const publicDir = join(process.cwd(), '..', 'public');
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