// Rate limits for the media profile share endpoint (the shared fixed-window limiter).

import { checkRateLimit as check, type RateLimit } from '~/utils/rateLimit.server';

export const SHARE_LIMIT: RateLimit = { max: 20, windowSeconds: 3600 };
export const READ_LIMIT: RateLimit = { max: 120, windowSeconds: 60 };

/**
 * Edits are cheap for the author and the only way to probe an edit token, so
 * this window is tighter than the share window rather than looser: 50 bits of
 * token against 30 attempts an hour is not a search anyone finishes.
 */
export const EDIT_LIMIT: RateLimit = { max: 30, windowSeconds: 3600 };

/** The public listing is one Redis round trip and renders for everyone. */
export const LIST_LIMIT: RateLimit = { max: 60, windowSeconds: 60 };

export const checkRateLimit = (request: Request, bucket: string, limit: RateLimit) =>
  check(request, 'mediaProfile', bucket, limit);
