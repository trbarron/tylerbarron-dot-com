import { useState, useEffect } from "react";
import { useLoaderData, json } from "@remix-run/react";
import { Suspense, lazy } from 'react';

import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import ImageDisplay from "~/components/CatImage";

const DetailedStats = lazy(() => import('~/components/DetailedStats'));

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
        console.log('Raw API response:', data);
        const basicData: BasicResponseData = JSON.parse(data.body);
        console.log('Parsed basicData:', basicData);

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

    useEffect(() => {
        const pollAPI = async () => {
            try {
                const response = await fetch(
                    "https://nj3ho46btl.execute-api.us-west-2.amazonaws.com/checoStage/checoRestEndpoint"
                );
                const data = await response.json();
            } catch (error) {
                console.error("Error polling API:", error);
            }
        };

        const pollInterval = setInterval(pollAPI, 240000);

        return () => clearInterval(pollInterval);
    }, []);

    return (
        <div className="bg-background bg-fixed min-h-screen flex flex-col">
            <Navbar />
            <main className="flex-grow">
                <Article title="" subtitle="">
                    <div className="text-center">
                        <h2 className="text-3xl text-black">Cat Work Tracker</h2>
                        {!basicData ? (
                            <h2 className="text-4xl font-bold text-red-500">Error loading data</h2>
                        ) : (
                            <>
                                <div className="my-4">
                                    <h3 className="text-2xl">
                                        Currently Working: {' '}
                                        <span className={`px-2 py-1 rounded ${
                                            basicData.is_present
                                                ? basicData.cat === 'Tuni'
                                                    ? 'bg-white text-black'
                                                    : 'bg-black text-white'
                                                : ''
                                        }`}>
                                            {basicData.is_present ? basicData.cat : 'None'}
                                        </span>
                                    </h3>
                                    {basicData.is_present && (
                                        <h3 className="text-2xl mt-2">
                                            Time Today: {getTotalWorkTime()}
                                        </h3>
                                    )}
                                </div>
                                <ImageDisplay />

                                <button
                                    onClick={toggleDetails}
                                    className="bg-white text-gray-800 rounded border-b-2 border-green-500 hover:border-green-500 hover:bg-green-500 hover:text-white shadow-md py-2 px-6 inline-flex items-center"
                                >
                                    {showDetails ? "Hide Details" : "Show Details"}
                                </button>

                                {showDetails && (
                                    <Suspense fallback={<div className="mt-8">Loading detailed stats...</div>}>
                                        <DetailedStats 
                                            data={detailedData} 
                                            isLoading={isDetailedLoading} 
                                        />
                                    </Suspense>
                                )}
                            </>
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