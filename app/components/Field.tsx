import { useId, type InputHTMLAttributes, type ReactNode } from 'react';

// Labelled form fields, as specified in DESIGN.md ("Inputs, Selects, Textareas").
// The input's own look (2px black border, grey on focus, square checkbox) comes
// from the global input rules in index.css, so these add no visual classes to
// the <input>: a utility there would override the design, which is how inputs
// drifted to accent rings and rounded grey borders.

const LABEL = 'font-neo mb-1 block text-xs font-bold tracking-wide text-black uppercase';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label: ReactNode;
  /** A line of help under the input. */
  hint?: ReactNode;
  /** Classes for the wrapper (grid spans, margins), not the input. */
  className?: string;
}

/**
 * A label over a full-width input, with an optional hint. Text, number, file:
 * anything but a checkbox, radio or range.
 *
 * @example
 * <TextField label="Username" value={name} onChange={(e) => setName(e.target.value)} />
 */
export function TextField({ label, hint, className = '', id, ...input }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className={className}>
      <label htmlFor={inputId} className={LABEL}>
        {label}
      </label>
      <input id={inputId} className="w-full" {...input} />
      {hint && <span className="font-neo mt-1 block text-xs text-gray-600">{hint}</span>}
    </div>
  );
}

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> {
  label: ReactNode;
  className?: string;
}

/** A square checkbox with its label to the right; the whole row is clickable. */
export function Checkbox({ label, className = '', ...input }: CheckboxProps) {
  return (
    <label className={`font-neo flex cursor-pointer items-center gap-2 text-sm font-medium text-black ${className}`}>
      <input type="checkbox" className="shrink-0" {...input} />
      {label}
    </label>
  );
}
