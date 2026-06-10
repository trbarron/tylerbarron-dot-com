// app/components/WorkTimeChart.tsx
import type { WorkTimeHistogramEntry } from '~/types/catTracker';

interface WorkTimeChartProps {
    data: WorkTimeHistogramEntry[];
}

const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}${ampm}`;
};

// The API sends true Mountain-Time hours (0-23). Rotate the display so the
// day starts at 5 AM, keeping the cats' overnight idle hours at the edges
// instead of splitting the evening across both ends of the chart.
const DISPLAY_START_HOUR = 5;
const displayOrder = (hour: number) => (hour - DISPLAY_START_HOUR + 24) % 24;

const WorkTimeChart = ({ data }: WorkTimeChartProps) => {
    // Safety check
    if (!data || data.length === 0) {
        return <div className="text-center text-gray-500">No data available</div>;
    }

    const sorted = [...data].sort((a, b) => displayOrder(a.hour) - displayOrder(b.hour));
    const maxCount = Math.max(...sorted.map(d => d.count), 1);
    const chartHeight = 300;
    // Old Lambdas don't send per-cat values; fall back to single-color bars.
    const hasSplitData = sorted.some(d => d.tuni !== undefined && d.checo !== undefined);

    return (
        <div className="w-full py-6 overflow-x-auto">
            <div className="text-sm font-medium mb-2 text-center">Work Time by Hour of Day</div>
            {hasSplitData ? (
                <div className="mb-6 flex justify-center gap-4 text-[10px] text-gray-600">
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 bg-[#2E3532]" /> Checo
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 border border-[#2E3532] bg-white" /> Tuni
                    </span>
                    <span className="flex items-center gap-1">
                        <span className="inline-block h-2.5 w-2.5 bg-gray-400" /> Unknown
                    </span>
                </div>
            ) : (
                <div className="mb-6" />
            )}
            
            {/* Chart container */}
            <div className="relative px-4 min-w-[600px]">
                {/* Y-axis labels */}
                {/* eslint-disable react/forbid-dom-props */}
                <div className="absolute left-0 top-0 flex flex-col justify-between text-[10px] text-gray-500" style={{ height: `${chartHeight}px` }}>
                    <span>{Math.round(maxCount)}m</span>
                    <span>{Math.round(maxCount * 0.75)}m</span>
                    <span>{Math.round(maxCount * 0.5)}m</span>
                    <span>{Math.round(maxCount * 0.25)}m</span>
                    <span>0m</span>
                </div>
                {/* eslint-enable react/forbid-dom-props */}

                {/* Bars container */}
                <div className="ml-12">
                    {/* eslint-disable react/forbid-dom-props */}
                    <div
                        className="flex items-end border-l border-b border-gray-300 pl-1"
                        style={{ height: `${chartHeight}px` }}
                    >
                        {sorted.map((entry) => {
                            const { hour, count } = entry;
                            const hasData = count > 0;
                            const hasSplit = entry.tuni !== undefined && entry.checo !== undefined;
                            const px = (value: number) => (value / maxCount) * chartHeight;
                            // Stack order bottom-up: Checo, Tuni, Unknown
                            // (rendered with flex-col-reverse).
                            const segments = hasSplit
                                ? [
                                      { key: 'checo', value: entry.checo ?? 0, className: 'bg-[#2E3532]' },
                                      { key: 'tuni', value: entry.tuni ?? 0, className: 'bg-white' },
                                      { key: 'other', value: entry.other ?? 0, className: 'bg-gray-400' },
                                  ].filter((s) => s.value > 0)
                                : [{ key: 'all', value: count, className: 'bg-[#2E3532]' }];
                            const totalPx = segments.reduce((sum, s) => sum + px(s.value), 0);

                            return (
                                <div key={hour} className="flex-1 flex flex-col items-center justify-end group min-w-[20px]">
                                    {/* Bar */}
                                    {hasData && (
                                        <div className="w-full relative flex flex-col items-center">
                                            {/* Value label on hover - positioned above bar */}
                                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-medium text-gray-700 whitespace-nowrap">
                                                {count.toFixed(0)}m
                                                {hasSplit &&
                                                    ` (C ${(entry.checo ?? 0).toFixed(0)} · T ${(entry.tuni ?? 0).toFixed(0)}${
                                                        (entry.other ?? 0) >= 0.5 ? ` · ? ${(entry.other ?? 0).toFixed(0)}` : ''
                                                    })`}
                                            </div>
                                            {/* Stacked bar; border keeps the white Tuni segment visible */}
                                            <div
                                                className="w-full overflow-hidden rounded-t border border-[#2E3532] flex flex-col-reverse"
                                                style={{ height: `${Math.max(totalPx, 2)}px` }}
                                            >
                                                {segments.map((s) => (
                                                    <div
                                                        key={s.key}
                                                        className={s.className}
                                                        style={{ height: `${px(s.value)}px` }}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* X-axis label */}
                                    <div className="text-[9px] text-gray-600 mt-4 -rotate-45 origin-top-left">
                                        {formatHour(hour)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {/* eslint-enable react/forbid-dom-props */}
                </div>
            </div>
            
            <div className="text-xs text-gray-500 text-center mt-6">Total Minutes</div>
        </div>
    );
};

export default WorkTimeChart;