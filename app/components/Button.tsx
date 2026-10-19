import type { ButtonHTMLAttributes } from 'react';

// The site's buttons, as specified in DESIGN.md ("Buttons"). Use <Button> for
// buttons and buttonClass() for links that should look like one.

export type ButtonVariant = 'primary' | 'secondary' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  /** The main action on a screen: black, inverts to white. */
  primary: 'border-black bg-black text-white not-disabled:hover:bg-white not-disabled:hover:text-black',
  /** Everything else: white, inverts to black. */
  secondary: 'border-black bg-white text-black not-disabled:hover:bg-black not-disabled:hover:text-white',
  /** Irreversible actions (resign, claim a win): secondary with a heavier border. */
  danger: 'border-black bg-white text-black not-disabled:hover:bg-black not-disabled:hover:text-white',
};

const SIZES: Record<ButtonSize, string> = {
  /** Inline actions next to other content. Still a 44 px tap target. */
  sm: 'min-h-11 px-3 py-1 text-sm',
  md: 'px-6 py-3 text-base',
  /** A screen's single call to action. */
  lg: 'px-6 py-4 text-lg',
};

/** Danger is one step heavier than the size's usual border. */
const BORDERS: Record<ButtonSize, { normal: string; danger: string }> = {
  sm: { normal: 'border-2', danger: 'border-4' },
  md: { normal: 'border-4', danger: 'border-8' },
  lg: { normal: 'border-4', danger: 'border-8' },
};

const BASE =
  'font-neo inline-flex items-center justify-center gap-2 font-bold tracking-wider uppercase transition-colors duration-100 ' +
  'disabled:cursor-not-allowed disabled:border-neutral-300 disabled:bg-neutral-200 disabled:text-neutral-700';

export interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** The classes for a button-styled element: <Button> uses it, and links can too. */
export function buttonClass({ variant = 'secondary', size = 'md', className = '' }: ButtonStyle = {}): string {
  const border = BORDERS[size][variant === 'danger' ? 'danger' : 'normal'];
  return [BASE, border, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(' ');
}

export type ButtonProps = ButtonStyle & ButtonHTMLAttributes<HTMLButtonElement>;

/**
 * @example
 * <Button variant="primary" size="lg" onClick={start}>Find my errors</Button>
 * <Button variant="danger" size="sm" onClick={resign}>Resign</Button>
 */
export default function Button({ variant, size, className, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass({ variant, size, className })} {...rest} />;
}
