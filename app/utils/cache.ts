import type { HeadersFunction } from 'react-router';

/**
 * For pages that render the same HTML for every visitor until the next deploy:
 * the homepage, blog posts, static project pages.
 *
 * Browsers always revalidate (`max-age=0`), so nobody is stuck on an old page.
 * CloudFront keeps a copy for five minutes and, for a day after that, answers
 * from the stale copy while it fetches a fresh one, so a visitor rarely waits
 * on the Lambda. The deploy invalidates the distribution, and old pages keep
 * working in the meantime because their hashed assets are kept (deploy.yml).
 *
 * Don't use it on a route whose loader reads live data, the request's query
 * string, or anything else that varies per visit. Responses from an error
 * boundary (a 404 from a loader) never get it: React Router only asks the
 * routes above the boundary for headers.
 */
export const PAGE_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

export const cachedPageHeaders: HeadersFunction = () => ({ 'Cache-Control': PAGE_CACHE_CONTROL });
