import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';
import { planRelease } from '../../scripts/plan-release.mjs';
import { checkLiveSite, ROUTES } from '../../scripts/check-live-site.mjs';

describe('release planning', () => {
  it('uses the next version without publishing', async () => {
    const release = vi.fn().mockResolvedValue({ nextRelease: { version: '5.63.0' } });
    expect(await planRelease('5.62.0', release)).toEqual({ version: '5.63.0', release: true });
    expect(release).toHaveBeenCalledWith({ dryRun: true });
  });

  it('keeps the version for changes that do not release', async () => {
    expect(await planRelease('5.62.0', vi.fn().mockResolvedValue(false))).toEqual({
      version: '5.62.0',
      release: false,
    });
  });

  it('propagates planning failures so the build cannot silently use a wrong version', async () => {
    await expect(planRelease('5.62.0', vi.fn().mockRejectedValue(new Error('auth failed')))).rejects.toThrow(
      'auth failed',
    );
  });

  it('cannot tag before the build, deploy and live check succeed', () => {
    const workflow = parse(readFileSync('.github/workflows/deploy.yml', 'utf8'));
    const steps = workflow.jobs.deploy.steps;
    const index = (command: string) => steps.findIndex((step: any) => step.run?.includes(command));
    const release = index('npx semantic-release');
    expect(index('plan-release.mjs')).toBeLessThan(index('npm run build:arc'));
    expect(index('npm run build:arc')).toBeLessThan(index('arc -- deploy'));
    expect(index('arc -- deploy')).toBeLessThan(index('check-live-site.mjs'));
    expect(index('check-live-site.mjs')).toBeLessThan(release);
    for (const command of ['npm run build:arc', 'arc -- deploy', 'check-live-site.mjs', 'npx semantic-release']) {
      const step = steps[index(command)];
      expect(step['continue-on-error']).not.toBe(true);
      expect(step.if).toBeUndefined(); // default success() prevents running after a failure
    }
    expect(steps[index('npm run build:arc')].env.APP_VERSION).toBe('${{ steps.version.outputs.version }}');
    expect(workflow.env.HUSKY).toBe(0);
  });
});

const html = '<html><body><footer>version: v5.63.0 · abcdef1</footer></body></html>';
const ok = (url: URL) => new Response(url.pathname === '/healthcheck' ? 'OK' : html);
const options = { version: '5.63.0', deploy: 'abcdef123456', delay: vi.fn(), log: vi.fn() };

describe('live bot checks', () => {
  it('checks every route with a bot user agent, deployment cache key and timeout', async () => {
    const fetchImpl = vi.fn().mockImplementation(ok);
    await checkLiveSite({ ...options, fetchImpl });
    expect(fetchImpl.mock.calls.map(([url]) => url.pathname)).toEqual(ROUTES);
    for (const [url, init] of fetchImpl.mock.calls) {
      expect(url.searchParams.get('deploy')).toBe('abcdef123456');
      expect(init.headers['User-Agent']).toContain('Googlebot');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('retries a transient Lambda failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('Unavailable', { status: 503 }))
      .mockImplementation(ok);
    const delay = vi.fn();
    await checkLiveSite({ ...options, fetchImpl, delay });
    expect(delay).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(ROUTES.length + 1);
  });

  it.each([
    { response: () => new Response('missing', { status: 404 }), error: 'HTTP 404' },
    { response: () => new Response('<html><body>Error</body></html>'), error: 'Incomplete' },
    { response: () => new Response(html.replace('5.63.0', '5.62.0')), error: 'expected build' },
    { response: () => new Response(html.replace('abcdef1', 'aaaaaaa')), error: 'expected build' },
  ])('fails on a persistent bad page: $error', async ({ response, error }) => {
    const fetchImpl = vi.fn().mockImplementation(response);
    await expect(checkLiveSite({ ...options, fetchImpl, attempts: 2 })).rejects.toThrow(error);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects a broken Redis even when the healthcheck status is 200', async () => {
    const fetchImpl = vi
      .fn()
      .mockImplementation((url: URL) => (url.pathname === '/healthcheck' ? new Response('Redis NOT READY') : ok(url)));
    await expect(checkLiveSite({ ...options, fetchImpl, attempts: 1 })).rejects.toThrow('Redis healthcheck');
  });
});
