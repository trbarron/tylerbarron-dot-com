// JSX typing for Google's <model-viewer> custom element (@google/model-viewer),
// loaded client-side in app/components/TrophyModel.tsx. Only the attributes we
// set are typed; the element accepts many more.
import type * as React from 'react';

interface ModelViewerAttributes extends React.HTMLAttributes<HTMLElement> {
  src?: string;
  alt?: string;
  poster?: string;
  'camera-controls'?: boolean | '';
  'auto-rotate'?: boolean | '';
  'auto-rotate-delay'?: number | string;
  'rotation-per-second'?: string;
  'disable-zoom'?: boolean | '';
  'interaction-prompt'?: 'auto' | 'none';
  'touch-action'?: string;
  'shadow-intensity'?: number | string;
  'shadow-softness'?: number | string;
  exposure?: number | string;
  'tone-mapping'?: 'aces' | 'commerce' | 'neutral' | 'none';
  'environment-image'?: string;
  'camera-orbit'?: string;
  loading?: 'auto' | 'lazy' | 'eager';
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'model-viewer': ModelViewerAttributes;
    }
  }
}
