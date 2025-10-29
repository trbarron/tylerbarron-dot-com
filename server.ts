import { createRequestHandler } from "@ballatech/react-router7-preset-aws";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const requestHandler = createRequestHandler({
  // @ts-expect-error - React Router build types
  build: () => import("./build/server/root/index.mjs"),
  mode: process.env.NODE_ENV,
  getLoadContext() {
    return {};
  },
});

async function handlerFn(event, context) {
  try {
    // In local dev, serve static files from public directory
    const path = event.rawPath || event.path || event.requestContext?.http?.path;
    
    if (process.env.NODE_ENV !== 'production' && path?.startsWith('/assets/')) {
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