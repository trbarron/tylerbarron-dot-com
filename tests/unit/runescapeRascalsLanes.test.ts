import { describe, expect, it } from 'vitest';
import { assembleSnapshot } from '~/utils/runescapeRascals/snapshot.server';

const fast = {
  generatedAt: 1060,
  lastEventAt: 1055,
  uptimeMin: 7,
  bots: [
    {
      name: 'bram',
      action: 'smelting',
      actionSince: 5,
      location: 'Falador',
      pos: { x: 2, z: 2 },
      hp: { cur: 9, max: 9 },
    },
  ],
};
const core = { partyTotal: 40, bots: [{ name: 'bram', goal: 'mine', skills: [] }], board: [], plan: null };

describe('assembleSnapshot', () => {
  it('lays the fast lane over the core bots and takes the stamps from it', () => {
    const snap = assembleSnapshot(fast, { core })!;
    expect(snap.generatedAt).toBe(1060);
    expect(snap.lastEventAt).toBe(1055);
    expect(snap.uptimeMin).toBe(7);
    expect(snap.bots[0]).toMatchObject({ name: 'bram', action: 'smelting', location: 'Falador', goal: 'mine' });
  });

  it('adds the sections that have been published and defaults the required lists', () => {
    const snap = assembleSnapshot(fast, { core, log: { log: [{ t: 1 }] }, scorecard: { scorecard: [{ t: 'x' }] } })!;
    expect(snap.log).toEqual([{ t: 1 }]);
    expect(snap.history).toEqual([]);
    expect(snap.scorecard).toEqual([{ t: 'x' }]);
  });

  it('has nothing without the core or the fast lane', () => {
    expect(assembleSnapshot(fast, {})).toBeNull();
    expect(assembleSnapshot(null, { core })).toBeNull();
  });
});
