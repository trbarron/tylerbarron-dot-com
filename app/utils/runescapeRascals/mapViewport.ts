export interface Point {
  x: number;
  z: number;
}
export interface MapBounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Current party and ten-minute trails determine the view; old roads and landmarks do not. */
export function partyViewport(bots: { pos: Point | null; trail?: Point[] }[]): MapBounds {
  const points = bots
    .flatMap((b) => [...(b.pos ? [b.pos] : []), ...(b.trail ?? [])])
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.z) && p.x > 0 && p.z > 0);
  if (!points.length) return { x0: 3000, x1: 3320, z0: 3120, z1: 3520 };
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minZ = Math.min(...points.map((p) => p.z));
  const maxZ = Math.max(...points.map((p) => p.z));
  // A stable 4:5 frame, with breathing room for labels and a useful minimum neighbourhood.
  const height = Math.ceil(Math.max(200, maxZ - minZ + 80, (maxX - minX + 80) / 0.8) / 40) * 40;
  const width = height * 0.8;
  const x = Math.round((minX + maxX) / 2 / 8) * 8;
  const z = Math.round((minZ + maxZ) / 2 / 8) * 8;
  return { x0: x - width / 2, x1: x + width / 2, z0: z - height / 2, z1: z + height / 2 };
}
export const insideMap = (p: Point, b: MapBounds) => p.x >= b.x0 && p.x <= b.x1 && p.z >= b.z0 && p.z <= b.z1;
export function pathInView(path: [number, number][], b: MapBounds): boolean {
  return (
    path.length > 0 &&
    Math.max(...path.map((p) => p[0])) >= b.x0 &&
    Math.min(...path.map((p) => p[0])) <= b.x1 &&
    Math.max(...path.map((p) => p[1])) >= b.z0 &&
    Math.min(...path.map((p) => p[1])) <= b.z1
  );
}
