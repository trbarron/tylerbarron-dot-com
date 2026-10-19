// Rate limits for the Maia Drills deck endpoint (the shared fixed-window limiter).

import { checkRateLimit as check, type RateLimit } from '~/utils/rateLimit.server';

/** A deck takes minutes of local analysis to build; 20 an hour is plenty. */
export const SAVE_LIMIT: RateLimit = { max: 20, windowSeconds: 3600 };
/** Favoriting is the only way to probe an edit token. */
export const FAVORITE_LIMIT: RateLimit = { max: 60, windowSeconds: 3600 };
export const READ_LIMIT: RateLimit = { max: 120, windowSeconds: 60 };

export const checkRateLimit = (request: Request, bucket: string, limit: RateLimit) =>
  check(request, 'maiaDrills', bucket, limit);
