// app/components/DetailedStats.tsx
import React, { Suspense } from 'react';
const WorkTimeChart = React.lazy(() => import('./WorkTimeChart'));

interface DetailedStatsProps {
  data: DetailedResponseData;
  isLoading: boolean;
}

export default function DetailedStats({ data, isLoading }: DetailedStatsProps) {
  if (isLoading) {
    return <h2 className="text-2xl text-gray-500">loading details</h2>;
  }

  return (
    <div className="mt-8">
      <p className="text-2xl mt-2">Last Week: {data.last_week_work_time.toFixed(2)} hours</p>
      <p className="text-2xl mt-2">Last 30 Days: {data.thirty_days_work_time.toFixed(2)} hours</p>
      <p className="text-2xl mt-2 mb-8">Lifetime: {data.lifetime_work_time.toFixed(2)} hours</p>
      
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