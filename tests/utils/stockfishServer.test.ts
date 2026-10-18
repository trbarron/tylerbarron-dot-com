/**
 * The server-side Stockfish wrapper, against the real engine from the devDependency.
 */

import { describe, it, expect } from 'vitest';
import { evaluate, scoreValue } from '~/utils/stockfish.server';

describe('stockfish.server', () => {
  it('sees a mate in one for the side to move', async () => {
    // White plays Qxf7#.
    const score = await evaluate('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', { depth: 10 });
    expect(score).toEqual({ type: 'mate', value: 1 });
  });

  it('scores a queen-down position as lost for the side to move', async () => {
    const score = await evaluate('rnb1kbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', { depth: 10 });
    expect(scoreValue(score)).toBeLessThan(-500);
  });

  it('takes searches one at a time', async () => {
    const fens = [
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1',
    ];
    const scores = await Promise.all(fens.map((fen) => evaluate(fen, { depth: 8 })));
    for (const s of scores) expect(Math.abs(scoreValue(s))).toBeLessThan(150);
  });

  it('ranks mates above any centipawn score, sooner mates higher', () => {
    expect(scoreValue({ type: 'mate', value: 1 })).toBeGreaterThan(scoreValue({ type: 'mate', value: 3 }));
    expect(scoreValue({ type: 'mate', value: 3 })).toBeGreaterThan(scoreValue({ type: 'cp', value: 5000 }));
    expect(scoreValue({ type: 'mate', value: -1 })).toBeLessThan(scoreValue({ type: 'mate', value: -3 }));
    expect(scoreValue({ type: 'mate', value: 0 })).toBeLessThan(scoreValue({ type: 'cp', value: -5000 }));
  });
});

describe('stockfish.server download', () => {
  it('refuses engine files whose hash doesn’t match, and writes nothing', async () => {
    const os = await import('node:os');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { vi } = await import('vitest');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-test-'));
    // No local copy (cwd without node_modules) and an empty /tmp: the loader has to download.
    vi.spyOn(process, 'cwd').mockReturnValue(tmp);
    vi.stubEnv('TMPDIR', tmp); // os.tmpdir() reads it
    const fetchMock = vi.fn(async () => new Response('tampered'));
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    try {
      const fresh = await import('~/utils/stockfish.server');
      await expect(fresh.evaluate('8/8/8/8/8/8/k7/4K3 w - - 0 1')).rejects.toThrow(/rejected/);
      expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/^https:\/\/unpkg\.com\/stockfish@18\.0\.7\/bin\//));
      expect(fs.readdirSync(path.join(tmp, 'stockfish-18.0.7'))).toEqual([]);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
