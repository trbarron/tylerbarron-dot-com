import { describe, it, expect } from 'vitest';
import { allowsEval, contentSecurityPolicy } from '~/utils/csp.server';

const scriptSrc = (path: string) =>
  contentSecurityPolicy(path)
    .split('; ')
    .find((d) => d.startsWith('script-src'))!;

describe('contentSecurityPolicy', () => {
  it('lets pages compile WASM but not eval', () => {
    for (const path of ['/', '/blog/anything', '/multiple-choice-chess/abc123/p_x', '/chesser-guesser']) {
      expect(scriptSrc(path), path).toContain("'wasm-unsafe-eval'");
      expect(scriptSrc(path), path).not.toContain("'unsafe-eval'");
    }
  });

  it('allows eval on the Maia page only, however its URL is spelled', () => {
    for (const path of ['/marginal-maia-mentor', '/marginal-maia-mentor/', '/Marginal-Maia-Mentor']) {
      expect(scriptSrc(path), path).toContain("'unsafe-eval'");
    }
    // Not a prefix match: nothing under or beside it inherits the grant.
    expect(allowsEval('/marginal-maia-mentor/x')).toBe(false);
    expect(allowsEval('/marginal-maia-mentor-2')).toBe(false);
    expect(allowsEval('/blog/marginalMaiaMentor')).toBe(false);
  });

  it('is otherwise the same policy on every page', () => {
    const strip = (p: string) => contentSecurityPolicy(p).replace(/'(wasm-)?unsafe-eval'/, 'EVAL');
    expect(strip('/marginal-maia-mentor')).toBe(strip('/'));
    expect(contentSecurityPolicy('/')).toContain("frame-ancestors 'none'");
  });
});
