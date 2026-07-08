import { useEffect, useState } from 'react';

// Root-relative on purpose: the CDN is same-origin with the site
// (VITE_CDN_URL === the site origin), so this resolves through CloudFront in
// production and is served by Vite from public/ in dev. Unlike getImageUrl's
// absolute CDN URL, it stays same-origin, which model-viewer's fetch() requires
// (the bucket sends no CORS headers).
const TROPHY_SRC = '/images/models/trophy.glb';

interface TrophyModelProps {
  /** Sizing/layout classes for the viewer; the parent must have a definite height. */
  className?: string;
  alt?: string;
  autoRotate?: boolean;
}

/**
 * Rotating 3D trophy. The <model-viewer> web component is imported client-side
 * only (never in an SSR chunk — keeps it out of the Lambda bundle, same reason
 * Video.tsx defers), so the server and first client render show a lightweight
 * placeholder of identical size (no layout shift), then the live viewer swaps in.
 *
 * Model: public/images/models/trophy.glb, served from the CDN. Replace that file
 * to change the trophy — no code change here.
 */
export default function TrophyModel({
  className = 'block h-full w-full',
  alt = 'Camel Up Cup champion trophy',
  autoRotate = true,
}: TrophyModelProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import('@google/model-viewer')
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // Leave the placeholder in place if the module fails to load.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div
        className={`flex items-center justify-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <span className="animate-pulse text-6xl motion-reduce:animate-none">🏆</span>
      </div>
    );
  }

  return (
    <model-viewer
      src={TROPHY_SRC}
      alt={alt}
      camera-controls=""
      auto-rotate={autoRotate ? '' : undefined}
      auto-rotate-delay={0}
      rotation-per-second="12deg"
      interaction-prompt="none"
      touch-action="pan-y"
      disable-zoom=""
      environment-image="neutral"
      shadow-intensity="1.1"
      shadow-softness="0.5"
      exposure="1.0"
      tone-mapping="commerce"
      className={className}
    />
  );
}
