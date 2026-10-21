import type { Bot, Route, Snapshot } from '~/utils/runescapeRascals/types';
import { DASHES, Marker } from './markers';

/** Places that would stretch the map without anyone usually being there. */
const OFF_MAP = new Set(['Falador', 'Tutorial Island', 'Varrock']);
const W = 480;
const PAD = 24;

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
  const botXY = bots.flatMap((b) => (b.pos ? [[X(b.pos.x), Y(b.pos.z)]] : []));
  const grid = (lo: number, hi: number) => {
    const out: number[] = [];
    for (let v = Math.ceil(lo / 50) * 50; v < hi; v += 50) out.push(v);
    return out;
  };

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Map of where each character is"
    >
      {grid(minX, maxX).map((gx) => (
        <line key={`x${gx}`} x1={X(gx)} x2={X(gx)} y1={0} y2={H} stroke="#e5e5e5" />
      ))}
      {grid(minZ, maxZ).map((gz) => (
        <line key={`z${gz}`} x1={0} x2={W} y1={Y(gz)} y2={Y(gz)} stroke="#e5e5e5" />
      ))}
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
        // A character standing on a place already names it; skip the label to avoid a pile-up.
        const crowded = botXY.some(([bx, by]) => Math.abs(bx - x) < 60 && Math.abs(by - y) < 12);
        return (
          <g key={l.name}>
            <rect x={x - 2.5} y={y - 2.5} width={5} height={5} fill="#fff" stroke="#404040" strokeWidth={1.5} />
            {!crowded && (
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
