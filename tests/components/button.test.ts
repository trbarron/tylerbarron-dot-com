/**
 * The design-language button classes (DESIGN.md, "Buttons").
 */

import { describe, it, expect } from 'vitest';
import { buttonClass } from '~/components/Button';

const classes = (style?: Parameters<typeof buttonClass>[0]) => buttonClass(style).split(' ');

describe('buttonClass', () => {
  it('defaults to a medium secondary: white, 4px border, inverts to black', () => {
    const c = classes();
    expect(c).toEqual(expect.arrayContaining(['bg-white', 'text-black', 'border-4', 'px-6', 'py-3']));
    expect(c).toEqual(expect.arrayContaining(['not-disabled:hover:bg-black', 'not-disabled:hover:text-white']));
  });

  it('makes primary black, inverting to white', () => {
    expect(classes({ variant: 'primary' })).toEqual(
      expect.arrayContaining([
        'bg-black',
        'text-white',
        'not-disabled:hover:bg-white',
        'not-disabled:hover:text-black',
      ]),
    );
  });

  it('marks danger with a border one step heavier, never with color', () => {
    expect(classes({ variant: 'danger' })).toContain('border-8');
    expect(classes({ variant: 'danger', size: 'sm' })).toContain('border-4');
    expect(classes({ size: 'sm' })).toContain('border-2');
    expect(buttonClass({ variant: 'danger' })).not.toMatch(/\b(red|amber|green)-/);
  });

  it('keeps small buttons a 44px tap target', () => {
    expect(classes({ size: 'sm' })).toEqual(expect.arrayContaining(['min-h-11', 'px-3', 'text-sm']));
  });

  it('appends caller classes last', () => {
    expect(classes({ className: 'w-full' }).at(-1)).toBe('w-full');
  });
});
