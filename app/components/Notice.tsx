import type { ReactNode } from 'react';

// Messages about the state of things, as specified in DESIGN.md ("Notices").
// Monochrome like the rest of the UI: an error is marked by a heavier border,
// not red, the way a destructive button is.

export type NoticeTone = 'error' | 'info';

const TONES: Record<NoticeTone, string> = {
  error: 'border-4 bg-white',
  info: 'border-2 bg-neutral-100',
};

export interface NoticeProps {
  tone?: NoticeTone;
  /** A bold uppercase first line, for notices that need a heading. */
  title?: ReactNode;
  /** A control on the right, such as Retry. */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * @example
 * {error && <Notice>{error}</Notice>}
 * <Notice title="Failed to load map">{error}</Notice>
 * <Notice tone="info">Couldn't access the clipboard. Press ⌘C to copy the selected link.</Notice>
 */
export default function Notice({ tone = 'error', title, action, className = '', children }: NoticeProps) {
  return (
    <div
      // Errors interrupt a screen reader; info waits its turn.
      role={tone === 'error' ? 'alert' : 'status'}
      className={`font-neo flex items-center justify-between gap-3 border-black px-4 py-3 text-sm text-black ${TONES[tone]} ${className}`}
    >
      {/* divs, not p: notices often sit inside .prose, whose p rule adds margins and resizes the text. */}
      <div className="min-w-0 break-words">
        {title && <div className="font-bold tracking-wide uppercase">{title}</div>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
