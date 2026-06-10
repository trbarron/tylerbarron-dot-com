/**
 * SSR render tests for the Cat Tracker detailed visuals.
 * Covers both API generations: the 2026-06-10 Lambda schema (per-cat fields)
 * and the old schema (no per-cat fields), which the UI must degrade to
 * gracefully if the frontend ships before the Lambda redeploy.
 */

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { ReactElement } from 'react';

import WorkTimeChart from '~/components/WorkTimeChart';
import type { CatDetailedData, WorkTimeHistogramEntry } from '~/types/catTracker';

// renderToString inserts <!-- --> between adjacent text nodes; strip them so
// assertions can match visible text like "828m".
const render = (el: ReactElement) => renderToString(el).replace(/<!-- -->/g, '');

// Sample values from the handoff doc's production-data run (2026-06-10).
const newHistogram: WorkTimeHistogramEntry[] = [
  { hour: 0, count: 12.5, tuni: 10.0, checo: 2.5, other: 0.0 },
  { hour: 5, count: 50.0, tuni: 25.0, checo: 25.0, other: 0.0 },
  { hour: 12, count: 828.47, tuni: 682.27, checo: 146.2, other: 0.0 },
  { hour: 23, count: 30.0, tuni: 0.0, checo: 20.0, other: 10.0 },
];

const oldHistogram: WorkTimeHistogramEntry[] = [
  { hour: 0, count: 12 },
  { hour: 6, count: 800 },
  { hour: 23, count: 30 },
];

describe('WorkTimeChart', () => {
  it('renders stacked bars and the per-cat legend for new-schema data', () => {
    const html = render(<WorkTimeChart data={newHistogram} />);
    expect(html).toContain('Checo');
    expect(html).toContain('Tuni');
    expect(html).toContain('Unknown');
    // Hover breakdown for the hour-12 bar
    expect(html).toContain('828m');
    expect(html).toContain('C 146');
    expect(html).toContain('T 682');
  });

  it('starts the display at 5 AM (true MT hours rotated for display)', () => {
    const html = render(<WorkTimeChart data={newHistogram} />);
    // 5AM must be the first hour label rendered; hour 0 (12AM) comes later.
    const first = html.indexOf('5AM');
    const midnight = html.indexOf('12AM');
    expect(first).toBeGreaterThan(-1);
    expect(midnight).toBeGreaterThan(first);
  });

  it('falls back to single-color bars without a legend for old-schema data', () => {
    const html = render(<WorkTimeChart data={oldHistogram} />);
    expect(html).not.toContain('Unknown');
    expect(html).toContain('800m');
  });
});

describe('DetailedStats', () => {
  it('renders per-cat split bars only when per_cat_work_time is present', async () => {
    const { default: DetailedStats } = await import('~/components/DetailedStats');

    const base = {
      last_week_work_time: 47.06,
      thirty_days_work_time: 135.07,
      lifetime_work_time: 1914.54,
      is_present: false,
      cat: null,
      work_time_histogram: newHistogram,
    } satisfies CatDetailedData;

    const withPerCat: CatDetailedData = {
      ...base,
      per_cat_work_time: {
        tuni: { today: '0:00:00', last_week_hours: 38.15, thirty_days_hours: 100.5, lifetime_hours: 599.74 },
        checo: { today: '0:05:44', last_week_hours: 8.91, thirty_days_hours: 34.57, lifetime_hours: 1007.25 },
        other: { today: '0:00:00', last_week_hours: 0.0, thirty_days_hours: 0.0, lifetime_hours: 307.55 },
      },
    };

    const newHtml = render(<DetailedStats data={withPerCat} isLoading={false} />);
    expect(newHtml).toContain('Who Did the Work?');
    expect(newHtml).toContain('Lifetime');
    // Lifetime totals include the unattributable "other" bucket
    expect(newHtml).toContain('1914.5 h');

    const oldHtml = render(<DetailedStats data={base} isLoading={false} />);
    expect(oldHtml).not.toContain('Who Did the Work?');
    expect(oldHtml).toContain('Work Time Distribution');
  });
});
