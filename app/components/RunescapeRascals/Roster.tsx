import { useState } from 'react';
import type { Bot } from '~/utils/runescapeRascals/types';
import { ago } from './format';
import PortraitViewer from './PortraitViewer';
import { activitySummary } from '~/utils/runescapeRascals/activity';
import { portraitUrl, shotUrl } from '~/utils/runescapeRascals/imageUrls';

interface RosterProps {
  bots: Bot[];
  now: number;
  assetBase?: string;
}

function Portrait({ bot, kind, assetBase }: { bot: Bot; kind: 'head' | 'body'; assetBase?: string }) {
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const fallback = `/images/runescape-rascals/portraits/${bot.name.toLowerCase()}-${kind}.png`;
  const live = !!bot.portraitVersion && !!assetBase && !failed;
  return (
    <img
      src={live ? portraitUrl(bot, kind, 0, assetBase) : fallback}
      alt=""
      width={kind === 'head' ? 84 : 30}
      height={84}
      loading="lazy"
      className={`h-16 w-full object-contain min-[480px]:h-20 ${hidden ? 'invisible' : ''}`}
      onError={() => (live ? setFailed(true) : setHidden(true))}
    />
  );
}
const imageButton =
  'cursor-pointer border-0 bg-transparent p-0 text-black hover:bg-neutral-100 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black';

export default function Roster({ bots, now, assetBase }: RosterProps) {
  const [screen, setScreen] = useState<string | null>(null);
  const [turning, setTurning] = useState<string | null>(null);
  const turned = bots.find((b) => b.name === turning);
  const shown = bots.find((b) => b.name === screen);
  return (
    <section className="font-neo border-4 border-black bg-white text-black" aria-label="The party">
      <div className="grid min-[480px]:grid-cols-2 lg:grid-cols-4">
        {bots.map((b, i) => (
          <article
            key={b.name}
            className={`min-w-0 border-black p-3 ${i > 0 ? 'border-t-2' : ''} ${i === 1 ? 'min-[480px]:border-t-0' : ''} ${i % 2 ? 'min-[480px]:border-l-2' : ''} ${i === 2 ? 'lg:border-l-2' : ''} lg:border-t-0`}
          >
            <header className="mb-2 flex items-baseline justify-between gap-2">
              <h2 className="m-0 text-base leading-none font-extrabold uppercase">{b.name}</h2>
              <span className="text-xl leading-none font-extrabold tabular-nums">
                {b.totalLevel}
                <span className="ml-1 text-[10px] font-bold tracking-wide text-neutral-600 uppercase">Total level</span>
              </span>
            </header>
            <div className="grid grid-cols-[48px_minmax(0,1fr)_72px] items-center gap-2 min-[480px]:grid-cols-1">
              <button
                type="button"
                aria-expanded={turning === b.name}
                aria-controls="rascals-portraits"
                aria-label={`View ${b.name}'s character`}
                onClick={() => setTurning((t) => (t === b.name ? null : b.name))}
                className={`grid grid-cols-2 items-center gap-1 ${imageButton} ${turning === b.name ? 'bg-neutral-100' : ''}`}
              >
                <Portrait key={`${b.name}-head-${b.portraitVersion}`} bot={b} kind="head" />
                <Portrait key={`${b.name}-body-${b.portraitVersion}`} bot={b} kind="body" />
              </button>
              <div className="min-w-0 min-[480px]:order-3">
                <p className="m-0 text-xs leading-snug font-semibold break-words min-[480px]:text-sm">
                  {activitySummary(b)}
                </p>
                <p className="mt-1 mb-0 text-xs leading-snug break-words text-neutral-600">{b.location}</p>
              </div>
              <button
                type="button"
                aria-expanded={screen === b.name}
                aria-controls="rascals-screens"
                aria-label={`View ${b.name}'s screen`}
                onClick={() => setScreen((s) => (s === b.name ? null : b.name))}
                className={`group relative mx-auto block w-full max-w-60 overflow-hidden lg:max-w-none ${imageButton}`}
              >
                {b.shotAt && assetBase ? (
                  <img
                    src={shotUrl(b, assetBase)}
                    alt=""
                    width={765}
                    height={503}
                    loading="lazy"
                    className="block aspect-[765/503] h-auto w-full object-cover"
                  />
                ) : (
                  <span className="grid aspect-[765/503] place-items-center bg-neutral-100 font-mono text-[10px] text-neutral-700">
                    No screenshot yet
                  </span>
                )}
                <span className="absolute right-0 bottom-0 bg-white/90 px-1 py-0.5 text-[9px] font-bold text-black normal-case group-hover:underline min-[480px]:text-[10px]">
                  {screen === b.name ? 'Close screen' : 'View screen'}
                </span>
              </button>
            </div>
          </article>
        ))}
      </div>
      {turned && (
        <PortraitViewer key={turned.name} bot={turned} assetBase={assetBase} onClose={() => setTurning(null)} />
      )}
      {shown && (
        <div id="rascals-screens" className="border-t-2 border-black p-3">
          <figure className="mx-auto my-0 max-w-3xl">
            <figcaption className="mb-2 flex items-center justify-between gap-2 text-xs text-neutral-600">
              <span>
                <strong className="text-black uppercase">{shown.name}</strong> ·{' '}
                {shown.shotAt ? ago(shown.shotAt, now) : 'waiting'}
              </span>
              <button
                type="button"
                onClick={() => setScreen(null)}
                className="cursor-pointer border-0 bg-transparent px-2 py-1 text-xs text-black hover:bg-neutral-100 hover:text-black"
              >
                Close screen
              </button>
            </figcaption>
            {shown.shotAt && assetBase && (
              <img
                src={shotUrl(shown, assetBase)}
                alt={`In-game view from ${shown.name}`}
                width={765}
                height={503}
                className="block h-auto w-full"
              />
            )}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold">Activity details</summary>
              <p className="mt-2 break-words">{shown.action.replace(/_/g, ' ')}</p>
            </details>
          </figure>
        </div>
      )}
    </section>
  );
}
