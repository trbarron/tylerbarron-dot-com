import { useEffect, useRef, useState, type ReactNode } from 'react';

const CLAMP: Record<number, string> = { 1: 'line-clamp-1', 2: 'line-clamp-2', 3: 'line-clamp-3' };

/** Hiding a single line saves less than the "More" link costs, so only clamp past this. */
const GRACE_LINES = 1;

interface ClampProps {
  lines?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
}

/** Text cut to a few lines, with a "more" toggle that only appears when enough was cut to be worth it. */
export default function Clamp({ lines = 2, className = '', children }: ClampProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  // Clamped until measured, so the server render and first paint match the common case.
  const [cut, setCut] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      // scrollHeight is the full text height whether or not the clamp is applied.
      const style = getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
      setCut(Math.round(el.scrollHeight / lineHeight) > lines + GRACE_LINES);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [children, lines]);

  return (
    <span className={`block ${className}`}>
      <span ref={ref} className={cut && !open ? CLAMP[lines] : 'block'}>
        {children}
      </span>
      {cut && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="font-neo mt-0.5 cursor-pointer border-0 bg-transparent p-0 text-[10px] font-bold tracking-wider text-black uppercase underline underline-offset-2 hover:bg-transparent hover:text-neutral-700"
        >
          {open ? 'Less' : 'More'}
        </button>
      )}
    </span>
  );
}
