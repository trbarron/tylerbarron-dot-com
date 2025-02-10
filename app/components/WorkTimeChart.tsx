// app/components/WorkTimeChart.tsx
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ClientOnly } from 'remix-utils/client-only';

interface WorkTimeChartProps {
    data: { hour: number; count: number }[];
}

const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}${ampm}`;
};

const WorkTimeChart = ({ data }: WorkTimeChartProps) => (
    <ClientOnly fallback={<div>Loading...</div>}>
        {() => (
            <ResponsiveContainer width="100%" height={400}>
                <BarChart
                    data={data}
                    margin={{ top: 20, right: 0, left: 0, bottom: 20 }}
                >
                    <XAxis
                        dataKey="hour"
                        tickFormatter={formatHour}
                        label={{ value: 'Hour of Day', position: 'bottom', offset: 0, fontSize: 12 }}
                        tick={{ fontSize: 10 }}
                    />
                    <YAxis
                        label={{ value: 'Total Minutes', angle: -90, position: 'insideLeft', offset: 10, fontSize: 12 }}
                        tick={{ fontSize: 10 }}
                    />
                    <Tooltip
                        formatter={(value) => [`${value.toFixed(2)} minutes`]}
                        labelFormatter={formatHour}
                        contentStyle={{ fontSize: 12 }}
                    />
                    <Bar dataKey="count" name="Work Time" fill="#2E3532" />
                </BarChart>
            </ResponsiveContainer>
        )}
    </ClientOnly>
);
export default WorkTimeChart;