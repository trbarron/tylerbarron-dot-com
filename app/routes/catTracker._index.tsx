import { useState, useEffect } from "react";
import { useLoaderData, json } from "@remix-run/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import ImageDisplay from "~/components/CatImage";

interface BasicResponseData {
    work_time: string;
    is_present: boolean;
    checo_time: string;
    tuni_time: string;
    cat: string;
}

interface DetailedResponseData extends BasicResponseData {
    last_week_work_time: number;
    thirty_days_work_time: number;
    lifetime_work_time: number;
    work_time_histogram: { hour: number; count: number }[];
}

export const loader = async () => {
    try {
        const basicResponse = await fetch(
            "https://nj3ho46btl.execute-api.us-west-2.amazonaws.com/checoStage/checoRestEndpoint"
        );
        const data = await basicResponse.json();
        const basicData: BasicResponseData = JSON.parse(data.body);

        return json({ basicData });
    } catch (error) {
        console.error("Error fetching data:", error);
        return json({ error: "Failed to load data" }, { status: 500 });
    }
};

export default function ChecoLiveTracker() {
    const loaderData = useLoaderData<{ basicData: BasicResponseData | undefined }>();
    const basicData = loaderData.basicData;
    const [detailedData, setDetailedData] = useState<DetailedResponseData | null>(null);
    const [showDetails, setShowDetails] = useState<boolean>(false);
    const [isDetailedLoading, setIsDetailedLoading] = useState<boolean>(false);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

    if (!basicData) {
        return <h2 className="text-4xl font-bold text-red-500">Error loading data</h2>;
    }

    useEffect(() => {
        let timer: NodeJS.Timeout | null = null;

        if (basicData && basicData.is_present) {
            timer = setInterval(() => {
                setElapsedSeconds((prevSeconds) => prevSeconds + 1);
            }, 1000);
        } else {
            setElapsedSeconds(0);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [basicData]);

    const formatTime = (totalSeconds: number): string => {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const getTotalWorkTime = (): string => {
        if (!basicData || !basicData.work_time) return "00:00:00";

        const timeParts = basicData.work_time.split(':');
        if (timeParts.length !== 3) return "00:00:00";

        const [hours, minutes, seconds] = timeParts.map(Number);
        if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return "00:00:00";

        const totalSeconds = hours * 3600 + minutes * 60 + seconds + elapsedSeconds;
        return formatTime(totalSeconds);
    };

    useEffect(() => {
        if (showDetails && !detailedData) {
            const fetchDetailedData = async () => {
                setIsDetailedLoading(true);
                try {
                    const response = await fetch(
                        "https://nj3ho46btl.execute-api.us-west-2.amazonaws.com/checoStage/checoRestEndpoint/details"
                    );
                    const responseData = await response.json();

                    // Parse the nested JSON in the body
                    const data: DetailedResponseData = JSON.parse(responseData.body);

                    // Validate the data
                    if (typeof data.last_week_work_time !== 'number' ||
                        typeof data.thirty_days_work_time !== 'number' ||
                        typeof data.lifetime_work_time !== 'number' ||
                        !Array.isArray(data.work_time_histogram)) {
                        throw new Error('Invalid data format received');
                    }

                    setDetailedData(data);
                } catch (error) {
                    console.error("Error fetching detailed data:", error);
                    setDetailedData(null);
                } finally {
                    setIsDetailedLoading(false);
                }
            };
            fetchDetailedData();
        }
    }, [showDetails, detailedData]);

    const toggleDetails = () => {
        setShowDetails(!showDetails);
    };

    const formatHour = (hour: number) => {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}${ampm}`;
    };

    return (
        <div className="bg-background bg-fixed min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-grow">
                <Article title="" subtitle="">
                    <div className="text-center">
                        <h2 className="text-3xl text-black">Cat Work Tracker</h2>
                        {basicData ? (
                            <>
                                <h2 className={`text-4xl ${basicData.is_present ? "text-green-500" : "text-red-500"}`}>
                                    {basicData.is_present ? "Actively Working" : "Not Actively Working"}
                                </h2>
                                <p className="text-3xl mt-4 mb-8">
                                    Time Worked Today: {getTotalWorkTime()}
                                </p>
                                <p
                                    className={`text-3xl mt-4 mb-8 px-4 py-2 rounded ${basicData.cat === "Tuni"
                                            ? "text-gray-600 bg-gray-100"
                                            : basicData.cat === "Checo"
                                                ? "text-gray-300 bg-black"
                                                : "invisible"
                                        }`}
                                >
                                    Cat Currently Working: {basicData.cat}
                                </p>

                                <ImageDisplay />

                                <button
                                    onClick={toggleDetails}
                                    className="bg-white text-gray-800 rounded border-b-2 border-green-500 hover:border-green-500 hover:bg-green-500 hover:text-white shadow-md py-2 px-6 inline-flex items-center "
                                >
                                    {showDetails ? "Hide Details" : "Show Details"}
                                </button>

                                {showDetails && (
    <div className="mt-8">
        {isDetailedLoading ? (
            <h2 className="text-2xl text-gray-500">loading details</h2>
        ) : detailedData ? (
            <>
                <p className="text-2xl mt-2">Last Week: {detailedData.last_week_work_time.toFixed(2)} hours</p>
                <p className="text-2xl mt-2">Last 30 Days: {detailedData.thirty_days_work_time.toFixed(2)} hours</p>
                <p className="text-2xl mt-2 mb-8">Lifetime: {detailedData.lifetime_work_time.toFixed(2)} hours</p>
                
                <h3 className="text-2xl font-bold mt-8 mb-4">Work Time Distribution (Last 30 Days)</h3>
                {detailedData.work_time_histogram && detailedData.work_time_histogram.length > 0 ? (
                    <ResponsiveContainer width="100%" height={400}>
                        <BarChart 
                            data={detailedData.work_time_histogram}
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
                ) : (
                    <p className="text-xl text-gray-500">No histogram data available</p>
                )}
            </>
        ) : (
            <h2 className="text-2xl font-bold text-red-500">Error loading detailed data</h2>
        )}
    </div>
)}

                            </>
                        ) : (
                            <h2 className="text-4xl font-bold text-red-500">Error loading data</h2>
                        )}
                        <a href="/CatTracker/Blog" className="block mt-8 mb-20">
                            Learn more about the Cat Tracker project
                        </a>
                    </div>
                </Article>
            </main>
            <Footer />
        </div>
    );
}