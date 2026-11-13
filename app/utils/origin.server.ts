import { timingSafeEqual } from 'node:crypto';

/** Production requests must come through the CloudFront origin custom header. */
export function isTrustedOrigin(
  headers: Record<string, string | undefined> | null | undefined,
  env: { ARC_ENV?: string; ORIGIN_VERIFY?: string } = process.env,
): boolean {
  if (env.ARC_ENV !== 'production') return true;
  if (!env.ORIGIN_VERIFY || !headers) return false;

  const names = Object.keys(headers).filter((name) => name.toLowerCase() === 'x-origin-verify');
  if (names.length !== 1) return false;
  const supplied = headers[names[0]];
  if (!supplied) return false;

  const expected = Buffer.from(env.ORIGIN_VERIFY);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
