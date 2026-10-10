/**
 * Tests for the legacy URL → canonical path mapping, covering both the
 * camelCase/PascalCase routes and the old static-site `.html` URLs.
 */

import { describe, it, expect } from 'vitest';
import { legacyRedirectPath } from '~/routes/legacyRedirect';

describe('legacyRedirectPath', () => {
  it('maps camelCase and PascalCase routes to kebab-case', () => {
    expect(legacyRedirectPath('/camelUpCup')).toBe('/camel-up-cup');
    expect(legacyRedirectPath('/CatTracker/Blog')).toBe('/cat-tracker/blog');
  });

  it('sends a renamed project to its new URL, keeping shared deck links', () => {
    expect(legacyRedirectPath('/maia-drills', '?deck=abc123')).toBe('/maia-marginal-mentor?deck=abc123');
  });

  it('preserves dynamic segments and the query string', () => {
    expect(legacyRedirectPath('/collaborativeCheckmate/AbC/xYz', '?a=1')).toBe(
      '/collaborative-checkmate/AbC/xYz?a=1',
    );
  });

  it('redirects old .html URLs', () => {
    expect(legacyRedirectPath('/CamelUpCup.html')).toBe('/camel-up-cup');
    expect(legacyRedirectPath('/B0XX.html')).toBe('/SSBM');
    expect(legacyRedirectPath('/b0xx.HTML')).toBe('/SSBM');
    expect(legacyRedirectPath('/cat-tracker.html')).toBe('/cat-tracker');
    expect(legacyRedirectPath('/index.html')).toBe('/');
  });

  it('returns null for unknown paths', () => {
    expect(legacyRedirectPath('/nope.html')).toBeNull();
    expect(legacyRedirectPath('/somethingElse')).toBeNull();
  });
});
