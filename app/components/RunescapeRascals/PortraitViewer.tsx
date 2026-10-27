import { useEffect, useRef, useState } from 'react';
import { portraitUrl } from '~/utils/runescapeRascals/imageUrls';
import type { Bot } from '~/utils/runescapeRascals/types';

interface PortraitViewerProps {
  bot: Bot;
  assetBase?: string;
  onClose: () => void;
}

/** Pixels of sideways drag that turn the figure by one view. */
const DRAG_STEP = 14;

const staticUrl = (b: Bot, kind: 'head' | 'body') =>
  `/images/runescape-rascals/portraits/${b.name.toLowerCase()}-${kind}.png`;

/** A larger head and body that turn through every stored view: drag or use the arrow keys. */
export default function PortraitViewer({ bot, assetBase, onClose }: PortraitViewerProps) {
  const views = bot.portraitVersion && bot.portraitAngles && bot.portraitAngles > 1 ? bot.portraitAngles : 1;
  const [angle, setAngle] = useState(0);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const turn = (to: number) => setAngle(((Math.round(to) % views) + views) % views);

  // Every view is fetched once, up front, so turning never waits on the network.
  useEffect(() => {
    if (views < 2) return;
    for (const kind of ['head', 'body'] as const)
      for (let a = 0; a < views; a++) new Image().src = portraitUrl(bot, kind, a, assetBase);
  }, [bot, views, assetBase]);

  const src = (kind: 'head' | 'body') => (views > 1 ? portraitUrl(bot, kind, angle, assetBase) : staticUrl(bot, kind));

  return (
    <div
      id="rascals-portraits"
      role="group"
      aria-label={`${bot.name}, turned through ${views} views`}
      className="border-t-2 border-black bg-neutral-50 p-3"
    >
      <div className="mx-auto mb-2 flex max-w-md items-center justify-between gap-2">
        <div>
          <span className="text-sm font-extrabold tracking-wider uppercase">{bot.name}</span>
          <p id="portrait-turn-hint" className="m-0 mt-1 text-xs text-neutral-600">
            {views > 1 ? 'Drag to rotate · ← → when focused' : 'Front view'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer border-2 border-black bg-transparent px-2 py-1 text-xs font-bold tracking-wider text-black uppercase hover:bg-neutral-200 hover:text-black"
        >
          Close
        </button>
      </div>
      <div
        tabIndex={views > 1 ? 0 : undefined}
        role="group"
        aria-label={`Rotate ${bot.name}`}
        aria-describedby="portrait-turn-hint"
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            turn(angle + (e.key === 'ArrowRight' ? 1 : -1));
          }
        }}
        className={`mx-auto grid max-w-md touch-pan-y grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)] items-end justify-center gap-4 py-3 select-none focus-visible:outline-2 focus-visible:outline-black ${views > 1 ? 'cursor-grab active:cursor-grabbing' : ''}`}
        onPointerDown={(e) => {
          if (views < 2) return;
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
          className="h-auto max-h-44 w-full object-contain [image-rendering:pixelated]"
        />
        <img
          src={src('body')}
          alt={`${bot.name}'s full figure, view ${angle + 1} of ${views}`}
          width={126}
          height={354}
          draggable={false}
          className="h-auto max-h-60 w-full object-contain [image-rendering:pixelated]"
        />
      </div>
    </div>
  );
}
