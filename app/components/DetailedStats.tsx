// app/components/DetailedStats.tsx
import React, { Suspense } from 'react';

import type { CatDetailedData } from '~/types/catTracker';

const WorkTimeChart = React.lazy(() => import('./WorkTimeChart'));

interface DetailedStatsProps {
  data: CatDetailedData | null;
  isLoading: boolean;
}

interface CatSplitBarProps {
  label: string;
  tuni: number;
  checo: number;
  other: number;
}

// Horizontal split bar in the same black/white language as the main page's
// today bar: Checo black, Tuni white. `other` (pre-model data that can't be
// attributed to either cat) gets its own gray segment — never folded into a cat.
function CatSplitBar({ label, tuni, checo, other }: CatSplitBarProps) {
  const total = tuni + checo + other;
  if (total <= 0) return null;

  const pct = (v: number) => (v / total) * 100;
  const segments = [
    { key: 'checo', value: checo, className: 'bg-black text-white' },
    { key: 'tuni', value: tuni, className: 'border-l-2 border-black bg-white text-black' },
    { key: 'other', value: other, className: 'border-l-2 border-black bg-gray-400 text-black' },
  ].filter((s) => s.value > 0);

  return (
    <div className="mb-4">
      <div className="mb-1 flex justify-between text-xs text-gray-600">
        <span className="font-semibold">{label}</span>
        <span>{total.toFixed(1)} h</span>
      </div>
      <div className="flex h-8 border-2 border-black">
        {/* eslint-disable react/forbid-dom-props */}
        {segments.map((s) => (
          <div
            key={s.key}
            className={`flex items-center justify-center text-sm font-bold ${s.className}`}
            style={{ width: `${pct(s.value)}%` }}
          >
            {pct(s.value) > 12 && `${pct(s.value).toFixed(0)}%`}
          </div>
        ))}
        {/* eslint-enable react/forbid-dom-props */}
      </div>
    </div>
  );
}

export default function DetailedStats({ data, isLoading }: DetailedStatsProps) {
  if (isLoading) {
    return <h2 className="text-xl text-gray-500">loading details</h2>;
  }

  if (!data) {
    return <h2 className="text-xl text-gray-500">Error loading detailed stats</h2>;
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
        <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Last Week</p>
          <p className="text-3xl font-bold text-black">{data.last_week_work_time.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">hours</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Last 30 Days</p>
          <p className="text-3xl font-bold text-black">{data.thirty_days_work_time.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">hours</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Lifetime</p>
          <p className="text-3xl font-bold text-black">{data.lifetime_work_time.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">hours</p>
        </div>
      </div>
      
      {data.per_cat_work_time && (
        <div className="max-w-3xl mx-auto mb-8">
          <h3 className="text-2xl font-bold mt-8 mb-4">Who Did the Work?</h3>
          <div className="mb-3 flex justify-center gap-6 text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 bg-black" /> Checo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 border-2 border-black bg-white" /> Tuni
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 bg-gray-400" /> Unknown
            </span>
          </div>
          <CatSplitBar
            label="Last Week"
            tuni={data.per_cat_work_time.tuni.last_week_hours}
            checo={data.per_cat_work_time.checo.last_week_hours}
            other={data.per_cat_work_time.other.last_week_hours}
          />
          <CatSplitBar
            label="Last 30 Days"
            tuni={data.per_cat_work_time.tuni.thirty_days_hours}
            checo={data.per_cat_work_time.checo.thirty_days_hours}
            other={data.per_cat_work_time.other.thirty_days_hours}
          />
          <CatSplitBar
            label="Lifetime"
            tuni={data.per_cat_work_time.tuni.lifetime_hours}
            checo={data.per_cat_work_time.checo.lifetime_hours}
            other={data.per_cat_work_time.other.lifetime_hours}
          />
          <p className="mt-2 text-xs text-gray-500">
            Unknown = early entries from before the custom model could tell the
            cats apart.
          </p>
        </div>
      )}

      <h3 className="text-2xl font-bold mt-8 mb-4">Work Time Distribution (Last 30 Days)</h3>
      {data.work_time_histogram && data.work_time_histogram.length > 0 ? (
        <Suspense fallback={<div className="h-[400px] flex items-center justify-center">Loading chart...</div>}>
          <WorkTimeChart data={data.work_time_histogram} />
        </Suspense>
      ) : (
        <p className="text-xl text-gray-500">No histogram data available</p>
      )}
    </div>
  );
}