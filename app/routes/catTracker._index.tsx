import { useState, useEffect, Suspense, lazy } from "react";
import { useLoaderData } from "react-router";

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

        return Response.json({ basicData });
    } catch (error) {
        console.error("Error fetching data:", error);
        return Response.json({ error: "Failed to load data" }, { status: 500 });
    }
};

export default function ChecoLiveTracker() {
    const loaderData = useLoaderData<{ basicData: BasicResponseData | undefined }>();
    const basicData = loaderData.basicData;
    const [detailedData, setDetailedData] = useState<DetailedResponseData | null>(null);
    const [showDetails, setShowDetails] = useState<boolean>(false);
    const [isDetailedLoading, setIsDetailedLoading] = useState<boolean>(false);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

    // All hooks must be called before any conditional returns
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
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const data = await response.json();
            } catch (error) {
                console.error("Error polling API:", error);
            }
        };

        const pollInterval = setInterval(pollAPI, 240000);

        return () => clearInterval(pollInterval);
    }, []);

    // Now it's safe to do conditional returns after all hooks
    if (!basicData) {
        return <h2 className="text-4xl font-bold text-red-500">Error loading data</h2>;
    }

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
                                <div className="my-8 max-w-2xl mx-auto px-4">
                                    {/* Main Info Card */}
                                    <div className="text-center mb-8">
                                        {/* Total Time - Hero Element */}
                                        <div className="text-sm text-black mb-3">Today</div>
                                        <div className="text-6xl font-bold font-mono mb-1">{getTotalWorkTime()}</div>
                                        
                                        {/* Currently Working - Subtle */}
                                        <div className="text-sm text-black my-2">
                                            Currently Working: {' '}
                                            <span className={`px-2 py-1 text-sm font-bold ${
                                                basicData.is_present
                                                    ? basicData.cat === 'Tuni'
                                                        ? 'bg-white text-black border border-black'
                                                        : 'bg-black text-white'
                                                    : 'text-gray-500'
                                            }`}>
                                                {basicData.is_present ? basicData.cat : 'None'}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Horizontal Percentage Bar with integrated legend */}
                                    <div>
                                        <div className="flex justify-between text-xs text-gray-600 mb-2 px-1">
                                            <span>■ Checo</span>
                                            <span>Tuni □</span>
                                        </div>
                                        
                                        <div className="flex h-10 border-2 border-gray-400">
                                            {(() => {
                                                const parseTime = (timeStr: string) => {
                                                    const parts = timeStr.split(':').map(Number);
                                                    return parts[0] * 3600 + parts[1] * 60 + parts[2];
                                                };
                                                
                                                const checoSeconds = parseTime(basicData.checo_time);
                                                const tuniSeconds = parseTime(basicData.tuni_time);
                                                const totalSeconds = checoSeconds + tuniSeconds;
                                                
                                                const checoPercent = totalSeconds > 0 ? (checoSeconds / totalSeconds) * 100 : 50;
                                                const tuniPercent = totalSeconds > 0 ? (tuniSeconds / totalSeconds) * 100 : 50;
                                                
                                                return (
                                                    <>
                                                        <div 
                                                            className="bg-black flex items-center justify-center text-white font-bold text-xl transition-all duration-500"
                                                            style={{ width: `${checoPercent}%` }}
                                                        >
                                                            {checoPercent > 15 && `${checoPercent.toFixed(0)}%`}
                                                        </div>
                                                        <div 
                                                            className="bg-white flex items-center justify-center text-black font-bold text-xl border-l-2 border-gray-400 transition-all duration-500"
                                                            style={{ width: `${tuniPercent}%` }}
                                                        >
                                                            {tuniPercent > 15 && `${tuniPercent.toFixed(0)}%`}
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                        
                                        {/* Explanation Text */}
                                        <div className="text-center mt-3 text-xs text-gray-600">
                                            {(() => {
                                                const parseTime = (timeStr: string) => {
                                                    const parts = timeStr.split(':').map(Number);
                                                    return parts[0] * 3600 + parts[1] * 60 + parts[2];
                                                };
                                                
                                                const checoSeconds = parseTime(basicData.checo_time);
                                                const tuniSeconds = parseTime(basicData.tuni_time);
                                                const totalSeconds = checoSeconds + tuniSeconds;
                                                
                                                if (totalSeconds === 0) return "No work time recorded today";
                                                
                                                const checoPercent = (checoSeconds / totalSeconds) * 100;
                                                const tuniPercent = (tuniSeconds / totalSeconds) * 100;
                                                
                                                if (checoPercent > tuniPercent) {
                                                    return `Checo contributed ${checoPercent.toFixed(0)}% of today's time`;
                                                } else if (tuniPercent > checoPercent) {
                                                    return `Tuni contributed ${tuniPercent.toFixed(0)}% of today's time`;
                                                } else {
                                                    return "Both cats worked equally today";
                                                }
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <ImageDisplay />

                                <button
                                    onClick={toggleDetails}
                                    className="bg-white text-black border-4 border-black px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white transition-all duration-100"
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