// app/components/DetailedStats.tsx
import React, { Suspense } from 'react';
const WorkTimeChart = React.lazy(() => import('./WorkTimeChart'));

interface DetailedResponseData {
  work_time: string;
  is_present: boolean;
  checo_time: string;
  tuni_time: string;
  cat: string;
  last_week_work_time: number;
  thirty_days_work_time: number;
  lifetime_work_time: number;
  work_time_histogram: { hour: number; count: number }[];
}

interface DetailedStatsProps {
  data: DetailedResponseData;
  isLoading: boolean;
}

export default function DetailedStats({ data, isLoading }: DetailedStatsProps) {
  if (isLoading) {
    return <h2 className="text-xl text-gray-500">loading details</h2>;
  }

  return (
    <div className="mt-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto mb-8">
        <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Last Week</p>
          <p className="text-3xl font-bold text-gray-900">{data.last_week_work_time.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">hours</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Last 30 Days</p>
          <p className="text-3xl font-bold text-gray-900">{data.thirty_days_work_time.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">hours</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-200">
          <p className="text-sm text-gray-600 mb-2">Lifetime</p>
          <p className="text-3xl font-bold text-gray-900">{data.lifetime_work_time.toFixed(2)}</p>
          <p className="text-xs text-gray-500 mt-1">hours</p>
        </div>
      </div>
      
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