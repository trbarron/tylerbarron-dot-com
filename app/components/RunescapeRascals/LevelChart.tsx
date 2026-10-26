import { useEffect, useRef, useState } from 'react';
import type { Achievement, Snapshot } from '~/utils/runescapeRascals/types';
import { DASHES, Marker, Swatch } from './markers';
import { clock } from './format';

interface LevelChartProps {
  names: string[];
  history: Snapshot['history'];
  /** Unlocks, drawn as a running count on a second axis at the right. */
  achievements?: Achievement[];
  /** Times are only drawn in the browser, in the reader's timezone. */
  mounted: boolean;
}

const H = 180;
const M = { l: 36, r: 96, t: 8, b: 22 };
const ACH = '#737373';

function niceTicks(lo: number, hi: number, n: number): number[] {
  const span = hi - lo || 1;
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find((s) => span / s <= n) ?? 1000;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v);
  return out;
}

interface TooltipProps {
  sample: Snapshot['history'][number];
  /** Achievements unlocked by this sample's time, when the snapshot carries them. */
  unlocked: number | null;
  x: number;
  width: number;
  mounted: boolean;
}

/** The hovered sample's levels, drawn inside the SVG so it needs no inline style to place it. */
function Tooltip({ sample, unlocked, x, width, mounted }: TooltipProps) {
  const rows = Object.entries(sample.levels).sort((a, b) => b[1] - a[1]);
  const boxW = 112;
  const boxH = 20 + (rows.length + (unlocked == null ? 0 : 1)) * 14;
  const bx = Math.min(x + 12, width - M.r - boxW);
  const by = M.t + 4;
  return (
    <g pointerEvents="none">
      <rect x={bx} y={by} width={boxW} height={boxH} fill="#fff" stroke="#000" strokeWidth={2} />
      <text x={bx + 8} y={by + 14} fontFamily="IBM Plex Mono, monospace" fontSize={11}>
        {mounted ? clock(sample.t) : ''}
      </text>
      {rows.map(([n, v], k) => (
        <text key={n} x={bx + 8} y={by + 28 + k * 14} fontSize={11}>
          <tspan fontFamily="Inter, sans-serif" fontWeight={800}>
            {n.toUpperCase()}
          </tspan>
          <tspan fontFamily="IBM Plex Mono, monospace"> {v}</tspan>
        </text>
      ))}
      {unlocked != null && (
        <text x={bx + 8} y={by + 28 + rows.length * 14} fontSize={11}>
          <tspan fontFamily="Inter, sans-serif" fontWeight={800}>
            ACH
          </tspan>
          <tspan fontFamily="IBM Plex Mono, monospace"> {unlocked}</tspan>
        </text>
      )}
    </g>
  );
}

/**
 * Total level over time: one line per character, told apart by dash and marker. When the
 * snapshot has achievements, the party's running unlock count is a stepped grey line on a
 * second axis at the right.
 */
export default function LevelChart({ names, history, achievements = [], mounted }: LevelChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (history.length < 2) {
    return (
      <div ref={box} className="px-4 py-6 text-center font-mono text-xs text-neutral-700 uppercase">
        Collecting data: one sample a minute
      </div>
    );
  }

  const t0 = history[0].t;
  const t1 = history[history.length - 1].t;
  const values = history.flatMap((s) => names.map((n) => s.levels[n]).filter((v): v is number => v != null));
  const lo = Math.floor(Math.min(...values) / 10) * 10;
  const hi = Math.max(lo + 10, Math.ceil(Math.max(...values) / 10) * 10);
  const X = (t: number) => M.l + ((t - t0) / (t1 - t0 || 1)) * (width - M.l - M.r);
  const Y = (v: number) => M.t + (1 - (v - lo) / (hi - lo)) * (H - M.t - M.b);

  // Achievements: how many were unlocked by time t, on its own right-hand scale.
  const unlockTimes = achievements.map((a) => a.t).sort((a, b) => a - b);
  const countAt = (t: number) => unlockTimes.filter((u) => u <= t).length;
  const hasAch = unlockTimes.length > 0;
  const aLo = Math.floor(countAt(t0) / 10) * 10;
  const aHi = Math.max(aLo + 10, Math.ceil(countAt(t1) / 10) * 10);
  const Y2 = (v: number) => M.t + (1 - (v - aLo) / (aHi - aLo)) * (H - M.t - M.b);
  const stepPts: (readonly [number, number])[] = [];
  if (hasAch) {
    let c = countAt(t0);
    stepPts.push([X(t0), Y2(c)]);
    for (const u of unlockTimes.filter((u) => u > t0 && u <= t1)) {
      stepPts.push([X(u), Y2(c)]);
      c += 1;
      stepPts.push([X(u), Y2(c)]);
    }
    stepPts.push([X(t1), Y2(c)]);
  }

  const series = names.map((n, i) => {
    const pts = history.filter((s) => s.levels[n] != null).map((s) => [X(s.t), Y(s.levels[n])] as const);
    return { n, i, pts };
  });
  // Direct labels at the line ends, nudged apart so they never overlap.
  const ends = series
    .filter((s) => s.pts.length)
    .map((s) => ({ n: s.n, y: s.pts[s.pts.length - 1][1] }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 12) ends[k].y = ends[k - 1].y + 12;

  const xTicks = Math.min(8, Math.max(2, Math.floor((width - M.l - M.r) / 100)));
  const tickTimes = Array.from({ length: xTicks + 1 }, (_, k) => t0 + ((t1 - t0) * k) / xTicks);
  const labels = mounted ? [...new Map(tickTimes.map((t) => [clock(t), t])).entries()] : [];
  const sample = hover == null ? null : history[hover];

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let best = 0;
    history.forEach((s, k) => {
      if (Math.abs(X(s.t) - px) < Math.abs(X(history[best].t) - px)) best = k;
    });
    setHover(best);
  };

  return (
    <div ref={box} className="relative px-2 pt-2 pb-1">
      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 px-2 text-xs font-bold tracking-wider uppercase">
        {names.map((n, i) => (
          <span key={n} className="inline-flex items-center gap-1">
            <Swatch index={i} dashed />
            {n}
          </span>
        ))}
        {hasAch && (
          <span className="inline-flex items-center gap-1 text-neutral-600">
            <svg width={22} height={8} aria-hidden="true">
              <line x1={0} x2={22} y1={4} y2={4} stroke={ACH} strokeWidth={3} />
            </svg>
            achievements (right axis)
          </span>
        )}
      </div>
      <svg
        viewBox={`0 0 ${width} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Total level over time for each character, with the number of achievements unlocked"
        className="block"
      >
        {niceTicks(lo, hi, 4).map((v) => (
          <g key={v}>
            <line x1={M.l} x2={width - M.r} y1={Y(v)} y2={Y(v)} stroke="#e5e5e5" />
            <text
              x={M.l - 6}
              y={Y(v) + 3}
              textAnchor="end"
              fontFamily="IBM Plex Mono, monospace"
              fontSize={10}
              fill="#404040"
            >
              {v}
            </text>
          </g>
        ))}
        {labels.map(([label, t], k) => (
          <text
            key={label}
            x={X(t)}
            y={H - 5}
            textAnchor={k === 0 ? 'start' : k === labels.length - 1 ? 'end' : 'middle'}
            fontFamily="IBM Plex Mono, monospace"
            fontSize={10}
            fill="#404040"
          >
            {label}
          </text>
        ))}
        <line x1={M.l} x2={width - M.r} y1={H - M.b} y2={H - M.b} stroke="#000" strokeWidth={2} />
        {hasAch && (
          <g>
            {niceTicks(aLo, aHi, 4).map((v) => (
              <text
                key={v}
                x={width - 4}
                y={Y2(v) + 3}
                textAnchor="end"
                fontFamily="IBM Plex Mono, monospace"
                fontSize={10}
                fill={ACH}
              >
                {v}
              </text>
            ))}
            <polygon
              points={`${stepPts.map((p) => p.join(',')).join(' ')} ${X(t1)},${H - M.b} ${X(t0)},${H - M.b}`}
              fill="#f5f5f5"
            />
            <polyline
              points={stepPts.map((p) => p.join(',')).join(' ')}
              fill="none"
              stroke={ACH}
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </g>
        )}
        {series.map(({ n, i, pts }) =>
          pts.length ? (
            <g key={n}>
              <polyline
                points={pts.map((p) => p.join(',')).join(' ')}
                fill="none"
                stroke="#000"
                strokeWidth={2}
                strokeDasharray={DASHES[i] || undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <Marker index={i} x={pts[pts.length - 1][0]} y={pts[pts.length - 1][1]} r={4.5} />
            </g>
          ) : null,
        )}
        {ends.map((e) => (
          <text key={e.n} x={width - M.r + 9} y={e.y + 4} fontFamily="Inter, sans-serif" fontWeight={800} fontSize={11}>
            {e.n.toUpperCase()}
          </text>
        ))}
        {sample && <line x1={X(sample.t)} x2={X(sample.t)} y1={M.t} y2={H - M.b} stroke="#000" strokeDasharray="3 3" />}
        <rect
          x={M.l}
          y={M.t}
          width={width - M.l - M.r}
          height={H - M.t - M.b}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
        {sample && (
          <Tooltip
            sample={sample}
            unlocked={hasAch ? countAt(sample.t) : null}
            x={X(sample.t)}
            width={width}
            mounted={mounted}
          />
        )}
      </svg>
    </div>
  );
}
