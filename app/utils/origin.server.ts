import { timingSafeEqual } from 'node:crypto';

/**
 * Production requests must come through the CloudFront origin custom header.
 * ORIGIN_VERIFY may list several comma-separated values, so a rotation can
 * accept the old and the new secret while CloudFront's header changes over.
 */
export function isTrustedOrigin(
  headers: Record<string, string | undefined> | null | undefined,
  env: { ARC_ENV?: string; ORIGIN_VERIFY?: string } = process.env,
): boolean {
  if (env.ARC_ENV !== 'production') return true;
  const secrets = (env.ORIGIN_VERIFY ?? '')
    .split(',')
    .map((secret) => secret.trim())
    .filter(Boolean);
  if (!secrets.length || !headers) return false;

  const names = Object.keys(headers).filter((name) => name.toLowerCase() === 'x-origin-verify');
  if (names.length !== 1) return false;
  const supplied = headers[names[0]];
  if (!supplied) return false;

  const actual = Buffer.from(supplied);
  let trusted = false;
  for (const secret of secrets) {
    const expected = Buffer.from(secret);
    // Compare against every secret, so timing doesn't reveal which one matched.
    trusted = (expected.length === actual.length && timingSafeEqual(expected, actual)) || trusted;
  }
  return trusted;
}
