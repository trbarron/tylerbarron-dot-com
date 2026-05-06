interface SanTextProps {
  san: string;
  captureClassName?: string;
}

// Render a SAN move with the capture 'x' visually de-emphasized so it doesn't
// dominate the glyph (e.g. "Nxe5" reads cleaner with a smaller x).
export default function SanText({ san, captureClassName = 'text-[0.7em] mx-px' }: SanTextProps) {
  const idx = san.indexOf('x');
  if (idx === -1) return <span className="uppercase">{san}</span>;
  return (
    <span className="inline-flex items-center uppercase leading-none">
      <span>{san.slice(0, idx)}</span>
      <span className={captureClassName}>x</span>
      <span>{san.slice(idx + 1)}</span>
    </span>
  );
}
