import { useEffect, useRef, useState } from 'react';
import type { Bot } from '~/utils/runescapeRascals/types';

interface PortraitViewerProps {
  bot: Bot;
  onClose: () => void;
}

/** Pixels of sideways drag that turn the figure by one view. */
const DRAG_STEP = 14;
const SPIN_MS = 110;

const liveUrl = (b: Bot, kind: 'head' | 'body', angle: number) =>
  `/api/runescapeRascals/portrait/${b.name}/${kind}?v=${encodeURIComponent(b.portraitVersion ?? '')}&a=${angle}`;
const staticUrl = (b: Bot, kind: 'head' | 'body') =>
  `/images/runescape-rascals/portraits/${b.name.toLowerCase()}-${kind}.png`;

/** A larger head and body that turn through every stored view: drag, use the slider or arrow keys, or let it spin. */
export default function PortraitViewer({ bot, onClose }: PortraitViewerProps) {
  const views = bot.portraitVersion && bot.portraitAngles && bot.portraitAngles > 1 ? bot.portraitAngles : 1;
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const turn = (to: number) => setAngle(((Math.round(to) % views) + views) % views);

  // Every view is fetched once, up front, so turning never waits on the network.
  useEffect(() => {
    if (views < 2) return;
    for (const kind of ['head', 'body'] as const)
      for (let a = 0; a < views; a++) new Image().src = liveUrl(bot, kind, a);
  }, [bot, views]);

  useEffect(() => {
    if (!spinning || views < 2) return;
    const id = setInterval(() => setAngle((a) => (a + 1) % views), SPIN_MS);
    return () => clearInterval(id);
  }, [spinning, views]);

  const src = (kind: 'head' | 'body') => (views > 1 ? liveUrl(bot, kind, angle) : staticUrl(bot, kind));

  return (
    <div
      id="rascals-portraits"
      role="group"
      aria-label={`${bot.name}, turned through ${views} views`}
      className="border-t-4 border-black p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-extrabold tracking-wider uppercase">{bot.name}</span>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer border-2 border-black px-2 py-1 text-xs font-bold tracking-wider uppercase hover:underline"
        >
          Close
        </button>
      </div>
      <div
        className={`flex touch-pan-y items-end justify-center gap-8 select-none ${views > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={(e) => {
          if (views < 2) return;
          setSpinning(false);
          drag.current = { x: e.clientX, from: angle };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          // Dragging right brings the front round to the right, so the view number falls.
          if (drag.current) turn(drag.current.from - (e.clientX - drag.current.x) / DRAG_STEP);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <img
          src={src('head')}
          alt={`${bot.name}'s head, view ${angle + 1} of ${views}`}
          width={256}
          height={256}
          draggable={false}
          className="h-[200px] w-[200px] object-contain [image-rendering:pixelated] md:h-[256px] md:w-[256px]"
        />
        <img
          src={src('body')}
          alt={`${bot.name}'s full figure, view ${angle + 1} of ${views}`}
          width={126}
          height={354}
          draggable={false}
          className="h-[280px] w-auto object-contain [image-rendering:pixelated] md:h-[354px]"
        />
      </div>
      {views > 1 ? (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            aria-pressed={spinning}
            onClick={() => setSpinning((s) => !s)}
            className="cursor-pointer border-2 border-black px-2 py-1 text-xs font-bold tracking-wider uppercase hover:underline"
          >
            {spinning ? 'Stop' : 'Spin'}
          </button>
          <input
            type="range"
            min={0}
            max={views - 1}
            value={angle}
            aria-label={`Turn ${bot.name}`}
            onChange={(e) => {
              setSpinning(false);
              setAngle(Number(e.target.value));
            }}
            className="min-w-0 flex-1 accent-black"
          />
        </div>
      ) : (
        <p className="mt-3 font-mono text-xs text-neutral-700 uppercase">Front view only for now</p>
      )}
    </div>
  );
}
