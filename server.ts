import { createRequestHandler } from "@remix-run/architect";
import * as build from "@remix-run/dev/server-build";

const requestHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
  getLoadContext(event) {
    return {};
  },
});

async function handlerFn(event, context) {
  try {
    const response = await requestHandler(event, context);
    return response;
  } catch (error) {
    console.error('Handler error:', error);
    throw error;
  }
}

export const handler = handlerFn;