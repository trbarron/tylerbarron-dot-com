import { createRequestHandler } from "@remix-run/architect";
import * as build from "@remix-run/dev/server-build";

console.log('Server starting...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Arc App URL:', process.env.ARC_APP_URL);
console.log('Server Build Path:', build);

const requestHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
  getLoadContext(event) {
    console.log('Request event:', JSON.stringify(event, null, 2));
    return {};
  },
});

async function handlerFn(event, context) {
  console.log('Lambda handler called with event:', JSON.stringify(event, null, 2));
  console.log('Context:', JSON.stringify(context, null, 2));
  try {
    const response = await requestHandler(event, context);
    console.log('Response:', JSON.stringify(response, null, 2));
    return response;
  } catch (error) {
    console.error('Handler error:', error);
    throw error;
  }
}

export const handler = handlerFn;