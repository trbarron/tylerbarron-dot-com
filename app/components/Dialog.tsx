import { useEffect, useId, useRef, type ReactNode } from 'react';

// The site's modal, as specified in DESIGN.md ("Dialogs"). Built on the native
// <dialog>, so showModal() gives it Escape, a focus trap, and an inert page
// behind it for free.

export type DialogSize = 'sm' | 'md';

const WIDTHS: Record<DialogSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
};

export interface DialogProps {
  open: boolean;
  /** Escape, a click on the backdrop, or a close control inside. */
  onClose: () => void;
  /** Rendered as the header bar and used as the dialog's accessible name. */
  title: ReactNode;
  /** A line under the title, such as how a game ended. */
  subtitle?: ReactNode;
  size?: DialogSize;
  children: ReactNode;
}

/**
 * @example
 * <Dialog open={confirming} onClose={() => setConfirming(false)} title="Resign this game?" size="sm">
 *   <div className="grid grid-cols-2 gap-3 p-4">…</div>
 * </Dialog>
 */
export default function Dialog({ open, onClose, title, subtitle, size = 'md', children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedBackdrop = useRef(false);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      // Escape fires `cancel`; let the parent decide, so `open` stays the source of truth.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // The dialog element itself (not its content) is the backdrop. Both ends of
      // the click must land there, so a text selection dragged out of an input
      // doesn't close it.
      onMouseDown={(e) => (pressedBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => {
        if (pressedBackdrop.current && e.target === e.currentTarget) onClose();
      }}
      className={`font-neo m-auto w-[calc(100%-2rem)] ${WIDTHS[size]} border-4 border-black bg-white p-0 text-black backdrop:bg-black/70`}
    >
      <div>
        <header className="border-b-4 border-black p-5 text-center">
          <h2 id={titleId} className="text-xl font-extrabold uppercase">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </header>
        {children}
      </div>
    </dialog>
  );
}
