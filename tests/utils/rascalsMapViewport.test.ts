import { describe, it, expect } from 'vitest';
import { partyViewport, insideMap, pathInView } from '~/utils/runescapeRascals/mapViewport';
import mapBounds from '~/utils/runescapeRascals/world-map.json';

describe('party map viewport', () => {
  it('includes Trish in the northern wilderness and all the other members', () => {
    const points = [
      { x: 3088, z: 3759 },
      { x: 3229, z: 3297 },
      { x: 3187, z: 3429 },
      { x: 3252, z: 3420 },
    ];
    const view = partyViewport(points.map((pos) => ({ pos })));
    expect(points.every((p) => insideMap(p, view))).toBe(true);
    expect(insideMap(points[0], mapBounds)).toBe(true);
    expect((view.x1 - view.x0) / (view.z1 - view.z0)).toBeCloseTo(0.8);
  });
  it('fits only the current party and recent trails rather than all old landmarks and roads', () => {
    const pos = { x: 3222, z: 3218 };
    const trail = [{ x: 3200, z: 3250 }];
    const view = partyViewport([{ pos, trail }]);
    expect(insideMap(pos, view)).toBe(true);
    expect(insideMap(trail[0], view)).toBe(true);
    expect(insideMap({ x: 3088, z: 3759 }, view)).toBe(false);
    expect(
      pathInView(
        [
          [1856, 4000],
          [1900, 4000],
        ],
        view,
      ),
    ).toBe(false);
  });
  it('handles missing positions and invalid trail points without an invalid viewBox', () => {
    expect(partyViewport([])).toEqual({ x0: 3000, x1: 3320, z0: 3120, z1: 3520 });
    const view = partyViewport([{ pos: { x: 3222, z: 3218 }, trail: [{ x: NaN, z: 0 }] }]);
    expect(Object.values(view).every(Number.isFinite)).toBe(true);
  });
});
