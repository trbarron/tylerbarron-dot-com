import { describe, expect, it } from 'vitest';
import { isTrustedOrigin } from '~/utils/origin.server';

const env = { ARC_ENV: 'production', ORIGIN_VERIFY: 'test-secret-0123456789' };

describe('origin verification', () => {
  it('requires a configured secret and exactly matching header in production', () => {
    expect(isTrustedOrigin(undefined, env)).toBe(false);
    expect(isTrustedOrigin({}, env)).toBe(false);
    expect(isTrustedOrigin({ 'x-origin-verify': '' }, env)).toBe(false);
    expect(isTrustedOrigin({ 'x-origin-verify': env.ORIGIN_VERIFY }, { ARC_ENV: 'production' })).toBe(false);
    expect(isTrustedOrigin({ 'X-Origin-Verify': env.ORIGIN_VERIFY }, env)).toBe(true);
    for (const value of [
      'wrong',
      'test-secret-0123456780',
      'é'.repeat(21),
      ` ${env.ORIGIN_VERIFY}`,
      `${env.ORIGIN_VERIFY},fake`,
    ]) {
      expect(isTrustedOrigin({ 'x-origin-verify': value }, env)).toBe(false);
    }
  });

  it('accepts any of several comma-separated secrets, for rotation', () => {
    const rotating = { ARC_ENV: 'production', ORIGIN_VERIFY: 'new-secret-0123456789, old-secret-0123456789' };
    expect(isTrustedOrigin({ 'x-origin-verify': 'new-secret-0123456789' }, rotating)).toBe(true);
    expect(isTrustedOrigin({ 'x-origin-verify': 'old-secret-0123456789' }, rotating)).toBe(true);
    for (const value of ['new-secret-0123456789, old-secret-0123456789', 'new-secret-0123456789,', 'other', ' ']) {
      expect(isTrustedOrigin({ 'x-origin-verify': value }, rotating)).toBe(false);
    }
    for (const ORIGIN_VERIFY of [',', ' , ', '']) {
      expect(isTrustedOrigin({ 'x-origin-verify': '' }, { ARC_ENV: 'production', ORIGIN_VERIFY })).toBe(false);
      expect(isTrustedOrigin({ 'x-origin-verify': ',' }, { ARC_ENV: 'production', ORIGIN_VERIFY })).toBe(false);
    }
  });

  it('rejects differently cased duplicate headers', () => {
    expect(isTrustedOrigin({ 'x-origin-verify': env.ORIGIN_VERIFY, 'X-Origin-Verify': env.ORIGIN_VERIFY }, env)).toBe(
      false,
    );
  });

  it('allows local and staging requests without a secret', () => {
    for (const ARC_ENV of ['testing', 'staging', undefined]) {
      expect(isTrustedOrigin(undefined, { ARC_ENV })).toBe(true);
    }
  });
});
