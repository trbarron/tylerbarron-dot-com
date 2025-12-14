/**
 * Test setup and utilities
 */

import { vi } from 'vitest';
import type { LoaderFunctionArgs, ActionFunctionArgs } from 'react-router';

/**
 * Create a mock Request object for testing loaders
 */
export function createRequest(url: string, init?: RequestInit): Request {
  // Ensure URL is absolute
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`;
  return new Request(fullUrl, init);
}

/**
 * Create mock LoaderFunctionArgs for testing
 */
export function createLoaderArgs(url: string): LoaderFunctionArgs {
  return {
    request: createRequest(url),
    params: {},
    context: {},
    unstable_pattern: {},
  } as LoaderFunctionArgs;
}

/**
 * Create mock ActionFunctionArgs for testing
 */
export function createActionArgs(url: string, init?: RequestInit): ActionFunctionArgs {
  return {
    request: createRequest(url, init),
    params: {},
    context: {},
    unstable_pattern: {},
  } as ActionFunctionArgs;
}

// Export for direct import
export { vi };
