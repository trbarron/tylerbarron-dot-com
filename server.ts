import { createRequestHandler } from "@ballatech/react-router7-preset-aws";

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
    const response = await requestHandler(event, context);
    return response;
  } catch (error) {
    console.error('Handler error:', error);
    throw error;
  }
}

export const handler = handlerFn;