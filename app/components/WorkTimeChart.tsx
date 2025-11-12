// app/components/WorkTimeChart.tsx
interface WorkTimeChartProps {
    data: { hour: number; count: number }[];
}

const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}${ampm}`;
};

const WorkTimeChart = ({ data }: WorkTimeChartProps) => {
    // Safety check
    if (!data || data.length === 0) {
        return <div className="text-center text-gray-500">No data available</div>;
    }
    
    const maxCount = Math.max(...data.map(d => d.count), 1);
    const chartHeight = 300;
    
    return (
        <div className="w-full py-6 overflow-x-auto">
            <div className="text-sm font-medium mb-8 text-center">Work Time by Hour of Day</div>
            
            {/* Chart container */}
            <div className="relative px-4 min-w-[600px]">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 flex flex-col justify-between text-[10px] text-gray-500" style={{ height: `${chartHeight}px` }}>
                    <span>{Math.round(maxCount)}m</span>
                    <span>{Math.round(maxCount * 0.75)}m</span>
                    <span>{Math.round(maxCount * 0.5)}m</span>
                    <span>{Math.round(maxCount * 0.25)}m</span>
                    <span>0m</span>
                </div>
                
                {/* Bars container */}
                <div className="ml-12">
                    <div 
                        className="flex items-end border-l border-b border-gray-300 pl-1"
                        style={{ height: `${chartHeight}px` }}
                    >
                        {data.map(({ hour, count }) => {
                            const heightPercentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                            const hasData = count > 0;
                            const barHeightPx = (heightPercentage / 100) * chartHeight;
                            
                            return (
                                <div key={hour} className="flex-1 flex flex-col items-center justify-end group min-w-[20px]">
                                    {/* Bar */}
                                    {hasData && (
                                        <div className="w-full relative flex flex-col items-center">
                                            {/* Value label on hover - positioned above bar */}
                                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-medium text-gray-700 whitespace-nowrap">
                                                {count.toFixed(0)}m
                                            </div>
                                            {/* Bar itself */}
                                            <div 
                                                className="w-full bg-[#2E3532] rounded-t transition-all duration-300 group-hover:bg-[#3f4a45]"
                                                style={{ height: `${barHeightPx}px` }}
                                            />
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
                </div>
            </div>
            
            <div className="text-xs text-gray-500 text-center mt-6">Total Minutes</div>
        </div>
    );
};

export default WorkTimeChart;