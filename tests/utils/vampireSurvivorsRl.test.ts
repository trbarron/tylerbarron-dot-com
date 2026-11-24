import { describe, expect, it } from 'vitest';
import { parseEval, parseEvent, parseStatus, parseUpdate } from '~/utils/vampireSurvivors/rl.server';

describe('Vampire Survivors RL parsers', () => {
  it('reads a status report from the training loop', () => {
    const status = parseStatus(
      JSON.stringify({
        host: 'mac',
        phase: 'rollout',
        detail: 'p0003: 16 seeds x 4 samples from 140049',
        update: 3,
        time: '2026-11-24T04:00:00Z',
        startedAt: '2026-11-24T03:05:00Z',
        gamesPlayed: 192,
        gameHours: 41.2,
        progress: { done: 20, expected: 64 },
        modes: ['ref', 'lane'],
        config: { lr: 0.0003 },
      }),
    );
    expect(status).toEqual({
      phase: 'rollout',
      detail: 'p0003: 16 seeds x 4 samples from 140049',
      update: 3,
      time: '2026-11-24T04:00:00Z',
      startedAt: '2026-11-24T03:05:00Z',
      gamesPlayed: 192,
      gameHours: 41.2,
      progress: { done: 20, expected: 64 },
      modes: ['ref', 'lane'],
    });
  });

  it('drops malformed values instead of failing the page', () => {
    expect(parseStatus(null)).toBeNull();
    expect(parseStatus('not json')).toBeNull();
    expect(parseStatus(JSON.stringify({ phase: 'eval' }))).toBeNull();
    expect(
      parseStatus(JSON.stringify({ time: '2026-11-24T04:00:00Z', progress: { done: 1, expected: 0 } }))?.progress,
    ).toBeNull();
    expect(parseUpdate('[1, 2]')).toBeNull();
    expect(parseEval(JSON.stringify({ update: 6, set: 'train' }))).toBeNull();
    expect(parseEvent(JSON.stringify({ text: 'no time' }))).toBeNull();
  });

  it('clamps mode shares and keeps nullable statistics', () => {
    const update = parseUpdate(
      JSON.stringify({
        update: 12,
        time: '2026-11-24T08:00:00Z',
        games: 64,
        medianSurvival: 842.5,
        modeShare: { ref: 1.2, drift: -0.1, lane: 'x' },
      }),
    );
    expect(update?.modeShare).toEqual({ ref: 1, drift: 0 });
    expect(update?.upgradeOverrides).toEqual({});
    const evaluation = parseEval(
      JSON.stringify({
        label: 'p0012',
        set: 'eval',
        update: 12,
        pairedMedian: 6.5,
        ciLow: null,
        ciHigh: 31,
        wins: 26,
        ties: 5,
        losses: 17,
      }),
    );
    expect(evaluation).toMatchObject({
      label: 'p0012',
      pairedMedian: 6.5,
      ciLow: null,
      ciHigh: 31,
      wins: 26,
      modeShare: null,
    });
  });
});
