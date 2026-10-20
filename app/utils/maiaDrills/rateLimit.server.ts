// Rate limits for the Maia Drills deck and progress endpoints (the shared fixed-window limiter).

import { checkRateLimit as check, type RateLimit } from '~/utils/rateLimit.server';

/** A deck takes minutes of local analysis to build; 20 an hour is plenty. */
export const SAVE_LIMIT: RateLimit = { max: 20, windowSeconds: 3600 };
/** Favoriting is the only way to probe an edit token. */
export const FAVORITE_LIMIT: RateLimit = { max: 60, windowSeconds: 3600 };
export const READ_LIMIT: RateLimit = { max: 120, windowSeconds: 60 };
/** One write per right answer; a card every 2.5 s, sustained, is faster than anyone drills. */
export const PROGRESS_LIMIT: RateLimit = { max: 240, windowSeconds: 600 };
/** Resetting wipes a deck's progress for everyone drilling it. */
export const RESET_LIMIT: RateLimit = { max: 20, windowSeconds: 3600 };

export const checkRateLimit = (request: Request, bucket: string, limit: RateLimit) =>
  check(request, 'maiaDrills', bucket, limit);
