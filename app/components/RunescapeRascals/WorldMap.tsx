import type { Bot, Route, Snapshot } from '~/utils/runescapeRascals/types';
import { DASHES, Marker } from './markers';

/** Places that would stretch the map without anyone usually being there. */
const OFF_MAP = new Set(['Falador', 'Tutorial Island', 'Varrock']);
const W = 480;
const PAD = 24;

/**
 * The free-to-play mainland, rendered in grey from the game's own world map (rs-sdk's
 * /mapview, by runscape-local's agents/map/render-basemap.ts), and the world tiles it covers.
 */
const BASEMAP = { href: '/images/runescape-rascals/f2p-map.webp', x0: 2880, x1: 3360, z0: 3120, z1: 3520 };

/** How a road is drawn, worst outcome first: identity stays with the characters' dashes. */
const ROAD = {
  died: { stroke: '#000', label: 'someone died' },
  hurt: { stroke: '#525252', label: 'someone got hurt' },
  safe: { stroke: '#c4c4c4', label: 'safe' },
} as const;

interface Road {
  a: string;
  b: string;
  trips: number;
  died: number;
  hurt: number;
  worst: keyof typeof ROAD;
}

/** The travel log, with both directions of a road merged. */
function roads(routes: Route[]): Road[] {
  const byPair = new Map<string, Road>();
  for (const r of routes) {
    const [a, b] = [r.from, r.to].sort();
    const road = byPair.get(`${a}|${b}`) ?? { a, b, trips: 0, died: 0, hurt: 0, worst: 'safe' as const };
    road.trips += r.trips - r.failed;
    road.died += r.died;
    road.hurt += r.hurt;
    road.worst = road.died ? 'died' : road.hurt ? 'hurt' : 'safe';
    byPair.set(`${a}|${b}`, road);
  }
  // One-off safe trips are noise on a map this small; anything that hurt someone always shows.
  return [...byPair.values()].filter((r) => r.trips >= 2 || r.died || r.hurt);
}

interface WorldMapProps {
  bots: Bot[];
  landmarks: Snapshot['landmarks'];
  routes?: Route[];
}

/** The key to the roads, for under the map. */
export function RoadKey() {
  return (
    <p className="m-0 flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 font-mono text-xs text-neutral-700">
      {(['safe', 'hurt', 'died'] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <svg width={22} height={10} viewBox="0 0 22 10" aria-hidden="true">
            <line x1={1} y1={5} x2={21} y2={5} stroke={ROAD[k].stroke} strokeWidth={3} strokeLinecap="round" />
          </svg>
          {k === 'died' ? 'someone died (✕)' : ROAD[k].label}
        </span>
      ))}
      <span>thicker = walked more · roads walked once are hidden</span>
    </p>
  );
}

/** Where everyone is, on real game coordinates, with ~10 minutes of trail and the roads they have walked. */
export default function WorldMap({ bots, landmarks, routes = [] }: WorldMapProps) {
  const places = landmarks.filter((l) => !OFF_MAP.has(l.name));
  const at = new Map(places.map((l) => [l.name, l]));
  const walked = roads(routes).filter((r) => at.has(r.a) && at.has(r.b));
  const pts = [...places, ...bots.flatMap((b) => (b.pos ? [b.pos] : []))];
  if (!pts.length) return null;
  const minX = Math.min(...pts.map((p) => p.x)) - PAD;
  const maxX = Math.max(...pts.map((p) => p.x)) + PAD;
  const minZ = Math.min(...pts.map((p) => p.z)) - PAD;
  const maxZ = Math.max(...pts.map((p) => p.z)) + PAD;
  const H = Math.round((W * (maxZ - minZ)) / (maxX - minX));
  const X = (x: number) => ((x - minX) / (maxX - minX)) * W;
  const Y = (z: number) => ((maxZ - z) / (maxZ - minZ)) * H;
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
      {walked.map((r) => {
        const a = at.get(r.a)!;
        const b = at.get(r.b)!;
        const style = ROAD[r.worst];
        const mx = (X(a.x) + X(b.x)) / 2;
        const my = (Y(a.z) + Y(b.z)) / 2;
        return (
          <g key={`${r.a}|${r.b}`}>
            <title>{`${r.a} ↔ ${r.b}: walked ${r.trips} time${r.trips === 1 ? '' : 's'}${r.died ? `, ${r.died} died` : ''}${r.hurt ? `, ${r.hurt} hurt` : ''}`}</title>
            <line
              x1={X(a.x)}
              y1={Y(a.z)}
              x2={X(b.x)}
              y2={Y(b.z)}
              stroke={style.stroke}
              strokeWidth={Math.min(5, 1.5 + Math.log2(r.trips))}
              strokeLinecap="round"
            />
            {r.died > 0 && (
              <g>
                <circle cx={mx} cy={my} r={6.5} fill="#fff" stroke="#000" strokeWidth={2} />
                <path
                  d={`M${mx - 3},${my - 3}L${mx + 3},${my + 3}M${mx + 3},${my - 3}L${mx - 3},${my + 3}`}
                  stroke="#000"
                  strokeWidth={2}
                />
              </g>
            )}
          </g>
        );
      })}
      {places.map((l) => {
        const x = X(l.x);
        const y = Y(l.z);
        const right = x > W * 0.75;
        return (
          <g key={l.name}>
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
      {bots.map((b, i) =>
        b.trail.length > 1 ? (
          <polyline
            key={`trail-${b.name}`}
            points={b.trail.map((p) => `${X(p.x)},${Y(p.z)}`).join(' ')}
            fill="none"
            stroke="#000"
            strokeWidth={1.5}
            strokeOpacity={0.35}
            strokeDasharray={DASHES[i] || undefined}
            strokeLinejoin="round"
          />
        ) : null,
      )}
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
