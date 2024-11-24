import React, { useState, Suspense, useEffect } from "react";
import { useLoaderData, useParams, useFetcher } from "@remix-run/react";
import { json, LoaderFunction, ActionFunction } from "@remix-run/node";
import { ClientOnly } from "remix-utils/client-only";
import 'react-chessground/dist/styles/chessground.css';
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import { Subarticle } from "~/components/Subarticle";
import { Modal } from '~/components/Modal';
import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';

// Import images
import whiteKingImage from '~/images/ChesserGuesser/whiteKing.png';
import blackKingImage from '~/images/ChesserGuesser/blackKing.png';



const client = new DynamoDB({
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    region: 'us-west-2'
});

const dynamoDb = DynamoDBDocument.from(client);

// Types
type PuzzleData = {
    fen: string;
    eval: number;
};

type LoaderData = {
    puzzleData: PuzzleData[];
};

type ScoresData = {
    userScore: string | null;
    userRank: number | null;
    totalUsers: number | null;
    topScores: Array<{ userName: string; score: number }>;
};

// Loader function (server-side)
export const loader: LoaderFunction = async ({ params }) => {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
    const puzzleIndexBase = dayOfYear % 80;

    const puzzleData: PuzzleData[] = [];
    for (let i = 0; i < 5; i++) {
        const cgValue = (puzzleIndexBase * 5 + i).toString();
        const queryParams = {
            TableName: "chesserGuesser",
            KeyConditionExpression: "#cg = :cgValue",
            ExpressionAttributeNames: { "#cg": "cg" },
            ExpressionAttributeValues: { ":cgValue": cgValue }
        };

        try {
            const data = await dynamoDb.query(queryParams).promise();
            if (!data.Items || data.Items.length === 0) {
                throw new Error('No data returned');
            }
            puzzleData.push({
                fen: data.Items[0].fen,
                eval: data.Items[0].eval
            });
        } catch (error) {
            console.error("Error fetching FEN from DynamoDB:", error);
            puzzleData.push({
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                eval: 0
            });
        }
    }

    return json({ puzzleData });
};

// Action function (server-side)
export const action: ActionFunction = async ({ request, params }) => {
    const formData = await request.formData();
    const score = formData.get("score");
    const username = params.username;

    if (typeof score !== "string" || !username) {
        return json({ error: "Invalid data" }, { status: 400 });
    }

    const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const userDateKey = `${username}#${currentDate}`; // Composite key of username and date

    const putParams = {
        TableName: "cgUserData",
        Item: {
            "userData": userDateKey,
            "score": parseFloat(score),
            "date": currentDate,
        }
    };

    try {
        await dynamoDb.put(putParams).promise();
        return json({ success: true });
    } catch (error) {
        console.error("Error saving score to DynamoDB:", error);
        return json({ error: "Failed to save score" }, { status: 500 });
    }
};



// Client-side only Chessground component
const ChessgroundWrapper = React.lazy(() => import('react-chessground'));

export default function ChesserGuesserDaily() {
    const { puzzleData } = useLoaderData<LoaderData>();
    const { username } = useParams();
    const fetcher = useFetcher();

    const [turnIndex, setTurnIndex] = useState(0);
    const [fen, setFen] = useState(puzzleData[0].fen);
    const [boardOrientation, setBoardOrientation] = useState(getCurrentPlayer(puzzleData[0].fen).toLowerCase());
    const [sliderValue, setSliderValue] = useState(0);
    const [currentTurn, setCurrentTurn] = useState(getCurrentPlayer(puzzleData[0].fen));
    const [totalDifference, setTotalDifference] = useState(0);
    const [lastSlider, setLastSlider] = useState(0);
    const [lastEval, setLastEval] = useState(0);
    const [showRankModal, setShowRankModal] = useState(false);
    const [loadingScores, setLoadingScores] = useState(false);
    const [scoresData, setScoresData] = useState<ScoresData>({ userScore: null, userRank: null, totalUsers: null, topScores: [] });

    useEffect(() => {
        if (showRankModal && username) {
            setLoadingScores(true);
            fetch(`/api/scores/${username}`)
                .then(response => response.json())
                .then(data => {
                    setScoresData(data);
                    setLoadingScores(false);
                });
        }
    }, [showRankModal, username]);

    const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSliderValue(Number(event.target.value));
    };

    function submitGuess() {
        const currentPuzzle = puzzleData[turnIndex];
        const difference = Math.abs(currentPuzzle.eval - sliderValue) / 100;
        setTotalDifference(prevTotal => prevTotal + difference);

        setLastEval(currentPuzzle.eval / 100);
        setLastSlider(sliderValue / 100);

        if (turnIndex >= 4) {
            fetcher.submit(
                { score: totalDifference.toString() },
                { method: "post" }
            );
            setShowRankModal(true);
        } else {
            setTurnIndex(prevIndex => prevIndex + 1);
            const nextPuzzle = puzzleData[turnIndex + 1];
            setFen(nextPuzzle.fen);
            setBoardOrientation(getCurrentPlayer(nextPuzzle.fen).toLowerCase());
            setCurrentTurn(getCurrentPlayer(nextPuzzle.fen));
            setSliderValue(0);
        }
    }

    function flipBoard() {
        setBoardOrientation(prev => prev === "white" ? "black" : "white");
    }

    function getCurrentPlayer(fen: string) {
        const parts = fen.split(' ');
        const turnIndicator = parts[1];
        return turnIndicator === 'w' ? 'White' : 'Black';
    }

    return (
        <div className="bg-background bg-fixed min-h-screen">
            <Navbar />
            <main className="flex-grow">
                <Article title="Chesser Guesser Daily" subtitle="">
                    <Subarticle>
                        <div className="mx-auto grid gap-x-4 grid-rows-2 md:grid-rows-1 grid-cols-1 md:grid-cols-2 md:ml-iauto" style={{ gridTemplateColumns: "80% 20%", marginLeft: "-0.5rem", marginRight: "0.5rem" }}>
                            <div className="w-100% col-span-2 md:col-span-1">
                                <ClientOnly fallback={<div>Loading...</div>}>
                                    {() => (
                                        <Suspense fallback={<div>Loading chess board...</div>}>
                                            <ChessgroundWrapper
                                                fen={fen}
                                                orientation={boardOrientation}
                                                style={{
                                                    width: '100%',
                                                    height: '0',
                                                    paddingBottom: '100%',
                                                    position: 'relative'
                                                }}
                                            />
                                        </Suspense>
                                    )}
                                </ClientOnly>
                                <div className="gap-2 flex w-full mt-4 rounded">
                                    <img src={blackKingImage} alt="Black King" className="w-12 h-12 flex-none" />
                                    <input
                                        type="range"
                                        min="-400"
                                        max="400"
                                        value={sliderValue}
                                        onChange={handleSliderChange}
                                        className="range flex-auto cursor-pointer appearance-none bg-gradient-to-r to-gray-300 from-gray-700 h-2 my-auto rounded-lg"
                                    />
                                    <img src={whiteKingImage} alt="White King" className="w-12 h-12 flex-none" />
                                </div>
                                <button
                                    className={`w-full rounded border-b-2 border-green-500 hover:border-green-600 hover:text-white shadow-md py-2 px-6 inline-flex flex-col items-center justify-center ${sliderValue === 0 ? 'bg-gray-500 text-black ' : sliderValue > 0 ? 'bg-white  text-black ' : 'bg-black text-white '}`}
                                    onClick={submitGuess}
                                >
                                    <span className={`text-xs ${sliderValue === 0 ? 'bg-gray-500 text-black ' : sliderValue > 0 ? 'bg-white  text-black ' : 'bg-black text-white '}`}>
                                        Submit
                                    </span>
                                    <span className={`text-xs ${sliderValue === 0 ? 'bg-gray-500 text-black ' : sliderValue > 0 ? 'bg-white  text-black ' : 'bg-black text-white '}`}>
                                        {(sliderValue / 100).toFixed(2)}
                                    </span>
                                </button>
                            </div>
                            <div className="justify-center text-center grid gap-y-3 h-80 md:h-full md:grid-cols-1	w-full grid-cols-3 col-span-2 md:col-span-1 gap-x-4 py-2 md:py-0 ">
                                <div className="bg-white shadow rounded-lg overflow-hidden w-full col-span-3 md:col-span-1 md:h-60 h-36 ">
                                    <div className="w-full text-gray border-b-2 z-30 bg-white border-green-500 py-0 md:py-2 inline-flex items-center justify-center font-bold text-sm md:text-md">
                                        Last Round:
                                    </div>
                                    <div className="flex items-center justify-center px-4 pb-0 -mt-3 z-10 md:py-2 bg-gray text-gray-light text-xs md:text-xs h-full overflow-y-hidden ">
                                        Answer: {lastEval.toFixed(2)} <br /> Guess: {lastSlider.toFixed(2)} <br /><br /> Difference: {(lastEval - lastSlider).toFixed(2)}
                                    </div>
                                </div>
                                <div className="bg-white shadow rounded-lg overflow-hidden w-full md:col-span-1 ">
                                    <div className="w-full text-gray border-b-2 z-30 bg-white border-green-500 py-0 md:py-2 inline-flex items-center justify-center font-bold text-sm md:text-md">
                                        Turn:
                                    </div>
                                    <div className="h-full flex items-center justify-center px-4 pb-0 -mt-3 z-10 md:pb-4 bg-gray text-gray-light text-md md:text-lg overflow-y-hidden">
                                        {turnIndex + 1}
                                    </div>
                                </div>
                                <div className={`shadow rounded-lg overflow-hidden w-full col-span-1 md:col-span-1 border ${currentTurn === 'White' ? 'bg-white border-black' : 'bg-black border-white'}`}>
                                    <div className={`w-full py-0 md:py-2 inline-flex items-center justify-center font-bold text-sm md:text-md my-auto h-full ${currentTurn === 'White' ? 'text-black' : 'text-white'}`}>
                                        {currentTurn} to move
                                    </div>
                                </div>
                                {/* Fix from here down */}
                                <button className="w-full bg-white text-gray-800 rounded border-b-2 border-green-500 hover:border-red-600 hover:bg-red-500 hover:text-white shadow-md py-2 px-6 inline-flex items-center " onClick={flipBoard}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6 mx-auto">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </Subarticle>
                </Article>
                <div className="visible ">
                    <Article title="About Chesser Guesser">
                        <Subarticle subtitle="">
                            <p>
                                Challenge yourself to guess the computer's evaluation of chess positions. Your goal is to estimate the position's value as accurately as possible -- the best guessers of the 5 daily positions can find themselves on the highscore list!
                            </p>
                        </Subarticle>
                    </Article>
                </div>
            </main>
            <Footer />
            {showRankModal && (
                <Modal onClose={() => setShowRankModal(false)}>
                    {loadingScores ? (
                        <p>Loading scores...</p>
                    ) : (
                        <div>
                            <div className="text-base font-normal text-gray-700">Your score: {scoresData.userScore}</div>
                            <div className="text-base font-normal text-gray-700">Your rank: {scoresData.userRank} of {scoresData.totalUsers}</div>
                            <div className="text-lg font-semibold text-gray-900 mt-4">Top 5 Scores:</div>
                            <ol className="list-decimal list-inside">
                                {scoresData.topScores.map((score, index) => (
                                    <li key={index} className="text-base text-gray-600">{score.userName} : {(score.score).toFixed(2)}</li>
                                ))}
                            </ol>
                        </div>
                    )}
                </Modal>
            )}
        </div>
    );
}