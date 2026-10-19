import type { ReactNode } from 'react';

// The site's titled container, as specified in DESIGN.md ("Cards & Containers"):
// a 4px black box with an optional title bar.

export interface PanelProps {
  /** The title bar. Without it, the panel is just the box. */
  title?: ReactNode;
  /** A second, smaller line under the title. */
  subtitle?: ReactNode;
  /** Right-hand side of the title bar: a legend, a count, a link. */
  aside?: ReactNode;
  /** A black title bar (game sidebars, leaderboards) instead of white over a rule (page sections). */
  dark?: boolean;
  /** Pad the content (p-6). Leave off for tables and lists that run edge to edge. */
  padded?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * @example
 * <Panel title="Leaderboard" dark>…</Panel>
 * <Panel title="Build a deck" padded>…</Panel>
 */
export default function Panel({
  title,
  subtitle,
  aside,
  dark = false,
  padded = false,
  className = '',
  children,
}: PanelProps) {
  const bar = dark ? 'border-b-4 border-black bg-black text-white' : 'border-b-2 border-black';
  return (
    <section className={`font-neo border-4 border-black bg-white text-black ${className}`}>
      {title && (
        <header className={`flex items-center justify-between gap-2 px-4 py-3 ${bar}`}>
          <div className="min-w-0">
            {/* m-0 p-0 text-inherit: panels often sit inside .prose, whose h2 and p rules would win otherwise. */}
            <h2 className="m-0 p-0 text-sm font-extrabold tracking-wider text-inherit uppercase">{title}</h2>
            {subtitle && (
              <p className={`m-0 w-auto p-0 text-xs ${dark ? 'text-white/70' : 'text-gray-600'}`}>{subtitle}</p>
            )}
          </div>
          {aside}
        </header>
      )}
      {padded ? <div className="p-6">{children}</div> : children}
    </section>
  );
}
