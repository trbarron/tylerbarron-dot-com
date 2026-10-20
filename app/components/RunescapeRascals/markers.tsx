// Identity is never color (the UI is monochrome): each character keeps one marker
// shape and one line dash everywhere they appear, in the chart, on the map and in tables.

const SHAPES = ['circle', 'square', 'triangle', 'diamond'] as const;
export const DASHES = ['', '9 5', '2 4', '12 4 2 4'];

interface MarkerProps {
  index: number;
  x: number;
  y: number;
  r: number;
  inverted?: boolean;
}

export function Marker({ index, x, y, r, inverted = false }: MarkerProps) {
  const fill = inverted ? '#fff' : '#000';
  const stroke = inverted ? '#000' : '#fff';
  const common = { fill, stroke, strokeWidth: 2 };
  switch (SHAPES[index % SHAPES.length]) {
    case 'circle':
      return <circle cx={x} cy={y} r={r} {...common} />;
    case 'square':
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} {...common} />;
    case 'triangle':
      return (
        <polygon
          points={`${x},${y - r * 1.15} ${x + r * 1.1},${y + r * 0.85} ${x - r * 1.1},${y + r * 0.85}`}
          {...common}
        />
      );
    default:
      return (
        <polygon
          points={`${x},${y - r * 1.25} ${x + r * 1.25},${y} ${x},${y + r * 1.25} ${x - r * 1.25},${y}`}
          {...common}
        />
      );
  }
}

/** A small inline key: the marker, and with `dashed` the line style too. */
export function Swatch({
  index,
  dashed = false,
  inverted = false,
}: {
  index: number;
  dashed?: boolean;
  inverted?: boolean;
}) {
  const w = dashed ? 30 : 14;
  return (
    <svg width={w} height={14} viewBox={`0 0 ${w} 14`} aria-hidden="true" className="inline-block shrink-0">
      {dashed && (
        <line x1={1} y1={7} x2={29} y2={7} stroke="#000" strokeWidth={2} strokeDasharray={DASHES[index] || undefined} />
      )}
      <Marker index={index} x={dashed ? 15 : 7} y={7} r={4.5} inverted={inverted} />
    </svg>
  );
}
