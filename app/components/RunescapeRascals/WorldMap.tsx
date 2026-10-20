import type { Bot, Snapshot } from '~/utils/runescapeRascals/types';
import { DASHES, Marker } from './markers';

/** Places that would stretch the map without anyone usually being there. */
const OFF_MAP = new Set(['Falador', 'Tutorial Island', 'Varrock']);
const W = 480;
const PAD = 24;

/** Where everyone is, on real game coordinates, with ~10 minutes of trail. */
export default function WorldMap({ bots, landmarks }: { bots: Bot[]; landmarks: Snapshot['landmarks'] }) {
  const places = landmarks.filter((l) => !OFF_MAP.has(l.name));
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
