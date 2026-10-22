import type { Bot, Route, Snapshot } from '~/utils/runescapeRascals/types';
import walkedRoutes from '~/utils/runescapeRascals/walked-routes.json';
import { Marker } from './markers';

/** Places that would stretch the map without anyone usually being there. */
const OFF_MAP = new Set(['Falador', 'Tutorial Island', 'Varrock']);
const W = 480;
const PAD = 24;

/**
 * The free-to-play mainland, rendered in grey from the game's own world map (rs-sdk's
 * /mapview, by runscape-local's agents/map/render-basemap.ts), and the world tiles it covers.
 */
const BASEMAP = { href: '/images/runescape-rascals/f2p-map.webp', x0: 2880, x1: 3360, z0: 3120, z1: 3520 };

/** Roads walked fewer times than this are left off: one-off detours are noise at this size. */
const WORN = 3;
const ROAD_STROKE = '#404040';

type Pt = [number, number];

/**
 * Resample a tile path every few tiles, then average neighbours, so the pathfinder's
 * stair-steps read as a road (the same smoothing as the share card).
 */
function smooth(path: Pt[]): Pt[] {
  const pts: Pt[] = [path[0]];
  for (const p of path.slice(1)) {
    const [ax, az] = pts[pts.length - 1];
    const steps = Math.floor(Math.hypot(p[0] - ax, p[1] - az) / 4);
    for (let i = 1; i < steps; i++) pts.push([ax + ((p[0] - ax) * i) / steps, az + ((p[1] - az) * i) / steps]);
    pts.push(p);
  }
  const k = 3;
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const win = pts.slice(Math.max(0, i - k), i + k + 1);
    out.push([win.reduce((n, q) => n + q[0], 0) / win.length, win.reduce((n, q) => n + q[1], 0) / win.length]);
  }
  return [...out, pts[pts.length - 1]];
}

const pairKey = (a: string, b: string) => [a, b].sort().join('|');

/**
 * The roads as walked, traced offline with the game's own pathfinder (runscape-local's
 * agents/map/export-routes.ts) since the live snapshot only names each road's two ends.
 * Both directions of a road merged, smoothed once at load.
 */
const TRACED = new Map<string, { trips: number; path: Pt[] }>();
for (const r of walkedRoutes as { from: string; to: string; trips: number; path: Pt[] }[]) {
  const key = pairKey(r.from, r.to);
  const known = TRACED.get(key);
  if (known) known.trips += r.trips;
  else TRACED.set(key, { trips: r.trips, path: smooth(r.path) });
}

interface Road {
  a: string;
  b: string;
  trips: number;
  died: number;
  hurt: number;
  /** World points along the walking path. */
  path: Pt[];
}

/**
 * The traced roads walked at least WORN times, with the live travel log's counts where it has
 * seen more (it only keeps recent roads, so it can't replace the export) and its harm.
 */
function roads(routes: Route[]): Road[] {
  const live = new Map<string, { trips: number; died: number; hurt: number }>();
  for (const r of routes) {
    const key = pairKey(r.from, r.to);
    const road = live.get(key) ?? { trips: 0, died: 0, hurt: 0 };
    road.trips += r.trips - r.failed;
    road.died += r.died;
    road.hurt += r.hurt;
    live.set(key, road);
  }
  const out: Road[] = [];
  for (const [key, traced] of TRACED) {
    const [a, b] = key.split('|');
    const seen = live.get(key);
    const trips = Math.max(traced.trips, seen?.trips ?? 0);
    if (trips >= WORN) out.push({ a, b, trips, died: seen?.died ?? 0, hurt: seen?.hurt ?? 0, path: traced.path });
  }
  // Busiest last, so they draw on top where roads share a stretch.
  return out.sort((x, y) => x.trips - y.trips);
}

const roadWidth = (trips: number) => 0.8 + 1.1 * Math.log10(trips + 1);

interface WorldMapProps {
  bots: Bot[];
  landmarks: Snapshot['landmarks'];
  routes?: Route[];
}

/** The key to the roads, for under the map. */
export function RoadKey() {
  return (
    <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 font-mono text-xs text-neutral-700">
      <span className="inline-flex items-center gap-1.5">
        <svg width={22} height={10} viewBox="0 0 22 10" aria-hidden="true">
          <line x1={2} y1={5} x2={20} y2={5} stroke="#fff" strokeWidth={5.5} strokeLinecap="round" />
          <line x1={2} y1={5} x2={20} y2={5} stroke={ROAD_STROKE} strokeWidth={3} strokeLinecap="round" />
        </svg>
        road they walk (thicker = more)
      </span>
    </p>
  );
}

function roadTitle(r: Road) {
  const walked = `walked ${r.trips} time${r.trips === 1 ? '' : 's'}`;
  const harm = `${r.died ? `, ${r.died} died` : ''}${r.hurt ? `, ${r.hurt} hurt` : ''}`;
  return `${r.a} ↔ ${r.b}: ${walked}${harm}`;
}

/** Where everyone is, on real game coordinates, and the roads they have walked. */
export default function WorldMap({ bots, landmarks, routes = [] }: WorldMapProps) {
  const places = landmarks.filter((l) => !OFF_MAP.has(l.name));
  const walked = roads(routes);
  const pts = [...places, ...bots.flatMap((b) => (b.pos ? [b.pos] : []))];
  if (!pts.length) return null;
  const minX = Math.min(...pts.map((p) => p.x)) - PAD;
  const maxX = Math.max(...pts.map((p) => p.x)) + PAD;
  const minZ = Math.min(...pts.map((p) => p.z)) - PAD;
  const maxZ = Math.max(...pts.map((p) => p.z)) + PAD;
  const H = Math.round((W * (maxZ - minZ)) / (maxX - minX));
  const X = (x: number) => ((x - minX) / (maxX - minX)) * W;
  const Y = (z: number) => ((maxZ - z) / (maxZ - minZ)) * H;
  const line = (path: Pt[]) => path.map(([x, z]) => `${X(x).toFixed(1)},${Y(z).toFixed(1)}`).join(' ');
  // Labels as boxes [x0, y0, x1, y1], so a place label that would sit on a character's name or
  // another label is left off (the base map names the big places anyway). Characters first.
  const taken: number[][] = bots.flatMap((b) => {
    if (!b.pos) return [];
    const x = X(b.pos.x);
    const y = Y(b.pos.z) - 7;
    const w = b.name.length * 9 + 10;
    return [x > W * 0.75 ? [x - w, y - 12, x, y + 3] : [x, y - 12, x + w, y + 3]];
  });
  const placeLabel = new Map<string, boolean>();
  for (const l of places) {
    const x = X(l.x);
    const y = Y(l.z);
    const w = (l.short ?? l.name).length * 6 + 8;
    const box = x > W * 0.75 ? [x - w, y - 6, x, y + 6] : [x, y - 6, x + w, y + 6];
    const clear = !taken.some((t) => box[0] < t[2] && t[0] < box[2] && box[1] < t[3] && t[1] < box[3]);
    if (clear) taken.push(box);
    placeLabel.set(l.name, clear);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Map of where each character is"
    >
      <rect width={W} height={H} fill="#fafafa" />
      <image
        href={BASEMAP.href}
        x={X(BASEMAP.x0)}
        y={Y(BASEMAP.z1)}
        width={X(BASEMAP.x1) - X(BASEMAP.x0)}
        height={Y(BASEMAP.z0) - Y(BASEMAP.z1)}
        preserveAspectRatio="none"
        aria-hidden="true"
      />
      {/* Every road's white edge before any road, so where two meet they read as one. */}
      {walked.map((r) => (
        <polyline
          key={`edge-${r.a}|${r.b}`}
          points={line(r.path)}
          fill="none"
          stroke="#fff"
          strokeWidth={roadWidth(r.trips) + 2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {walked.map((r) => (
        <polyline
          key={`${r.a}|${r.b}`}
          points={line(r.path)}
          fill="none"
          stroke={ROAD_STROKE}
          strokeWidth={roadWidth(r.trips)}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <title>{roadTitle(r)}</title>
        </polyline>
      ))}
      {places.map((l) => {
        const x = X(l.x);
        const y = Y(l.z);
        const right = x > W * 0.75;
        return (
          <g key={l.name}>
            <title>{l.name}</title>
            <rect x={x - 2.5} y={y - 2.5} width={5} height={5} fill="#fff" stroke="#404040" strokeWidth={1.5} />
            {placeLabel.get(l.name) && (
              <text
                x={x + (right ? -6 : 6)}
                y={y + 3}
                textAnchor={right ? 'end' : 'start'}
                fontFamily="IBM Plex Mono, monospace"
                fontSize={10}
                fill="#404040"
                stroke="#fff"
                strokeWidth={3}
                paintOrder="stroke"
              >
                {l.short ?? l.name}
              </text>
            )}
          </g>
        );
      })}
      {bots.map((b, i) => {
        if (!b.pos) return null;
        const x = X(b.pos.x);
        const y = Y(b.pos.z);
        const right = x > W * 0.75;
        return (
          <g key={b.name}>
            <title>{`${b.name}: ${b.location} (${b.pos.x}, ${b.pos.z})`}</title>
            <Marker index={i} x={x} y={y} r={6} />
            <text
              x={x + (right ? -10 : 10)}
              y={y - 7}
              textAnchor={right ? 'end' : 'start'}
              fontFamily="Inter, sans-serif"
              fontWeight={800}
              fontSize={12}
              stroke="#fff"
              strokeWidth={4}
              paintOrder="stroke"
            >
              {b.name.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
