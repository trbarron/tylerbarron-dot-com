import React, { useState, Suspense, useEffect } from "react";
import { useNavigate } from "@remix-run/react";
import { Chess } from 'chess.js';
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunction } from "@remix-run/node";
import { ClientOnly } from "remix-utils/client-only";
import 'react-chessground/dist/styles/chessground.css';
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import { Subarticle } from "~/components/Subarticle";

// Import images
import whiteKingImage from '~/images/ChesserGuesser/whiteKing.png';
import blackKingImage from '~/images/ChesserGuesser/blackKing.png';

// AWS SDK import
import AWS from 'aws-sdk';

// Define the type for the loader data
type LoaderData = {
  randomFEN: string;
  evalScore: number;
};

// Loader function (server-side)
export const loader: LoaderFunction = async () => {
  // Configure AWS
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-west-2',
  });

  const dynamoDb = new AWS.DynamoDB.DocumentClient();
  const randomCgValue = Math.floor(Math.random() * 400).toString();
  const params = {
    TableName: "chesserGuesser",
    KeyConditionExpression: "#cg = :cgValue",
    ExpressionAttributeNames: { "#cg": "cg" },
    ExpressionAttributeValues: { ":cgValue": randomCgValue }
  };

  try {
    const data = await dynamoDb.query(params).promise();
    if (!data.Items || data.Items.length === 0) {
      throw new Error('No data returned');
    }
    return json({
      randomFEN: data.Items[0].fen,
      evalScore: data.Items[0].eval
    });
  } catch (error) {
    console.error("Error fetching FEN from DynamoDB:", error);
    return json({
      randomFEN: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      evalScore: 0
    });
  }
};

// Client-side only Chessground component
const ChessgroundWrapper = React.lazy(() => import('react-chessground'));

export default function ChesserGuesserUnlimited() {
  const { randomFEN, evalScore } = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  const [chess, setChess] = useState(new Chess(randomFEN));
  const [fen, setFen] = useState(randomFEN);
  const [boardOrientation, setBoardOrientation] = useState(getCurrentPlayer(randomFEN).toLowerCase());
  const [sliderValue, setSliderValue] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(getCurrentPlayer(randomFEN));
  const [streak, setStreak] = useState(0);
  const [lastSlider, setLastSlider] = useState(0);
  const [lastEval, setLastEval] = useState(0);
  const [positiveMessage, setPositiveMessage] = useState(getPositiveMessage());
  const [negativeMessage, setNegativeMessage] = useState(getNegativeMessage());

  useEffect(() => {
    setChess(new Chess(randomFEN));
    setFen(randomFEN);
    setBoardOrientation(getCurrentPlayer(randomFEN).toLowerCase());
    setCurrentTurn(getCurrentPlayer(randomFEN));
  }, [randomFEN]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(event.target.value));
  };

  function submitGuess() {
    let difference = Math.abs(evalScore - sliderValue) / 100;
    let correctSide = false;
    if (evalScore > 0.2 && sliderValue > 0) {
      correctSide = true;
    } else if (evalScore < -0.2 && sliderValue < 0) {
      correctSide = true;
    } else if (evalScore < 0.2 && evalScore > -0.2 && sliderValue < 0.2 && sliderValue > -0.2) {
      correctSide = true;
    }
    if (correctSide) {
      setStreak(streak + 1);
    } else {
      setStreak(0);
    }
    setLastEval(evalScore / 100);
    setLastSlider(sliderValue / 100);

    // Reset the board after submitting the guess
    resetBoard();

    return difference;
  }

  function resetBoard() {
    submit(null, { method: "get", action: "." });
  }

  function flipBoard() {
    setBoardOrientation(prev => prev === "white" ? "black" : "white");
  }

  function getPositiveMessage() {
    const messages = [
      "Keep it up!", "Nice!", "Good job!", "You're on a roll!",
      "You're doing great!", "You're on fire!", "You're killing it!",
      "You're unstoppable!", "You're a genius!", "You're a master!",
      "You're a legend!", "You're a god!", "You're a beast!",
      "You're a monster!", "Let's go!", "Correct!!"
    ];
    return messages[Math.floor(Math.random() * messages.length)] + " 👍";
  }

  function getNegativeMessage() {
    const messages = [
      "Keep trying!", "Next time!", "Good effort!", "You'll get it!",
      "You're close!", "You're almost there!", "You're getting warmer!",
      "Close, but no cigar!", "Oomph! Next time!", "You're so close!",
      "Maybe next time!"
    ];
    return messages[Math.floor(Math.random() * messages.length)] + " 😓";
  }

  function getCurrentPlayer(fen: string) {
    const parts = fen.split(' ');
    const turnIndicator = parts[1];
    return turnIndicator === 'w' ? 'White' : 'Black';
  }

  async function resetBoard() {
    navigate(".", { replace: true });
  }

  return (
    <div className="bg-background bg-fixed min-h-screen">
      <Navbar />
      <main className="flex-grow">
        <Article
          title="Chesser Guesser Unlimited"
          subtitle=""
        >
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
                  onClick={() => {
                    submitGuess()
                    resetBoard()
                  }}
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
                  <div className="w-full text-gray border-b-2 border-green-500 py-0 md:py-2 inline-flex items-center justify-center font-bold text-sm md:text-md">
                    Last Round:
                  </div>
                  <div className="flex items-center justify-center px-4 py-0 md:py-2 bg-gray text-gray-light text-xs md:text-xs h-full overflow-y-hidden ">
                    Answer: {lastEval.toFixed(2)} <br /> Guess: {lastSlider.toFixed(2)} <br /><br /> Difference: {(lastEval - lastSlider).toFixed(2)} <br /><br /> {lastEval === 0 ? "" : (streak > 0 ? positiveMessage : negativeMessage)}
                  </div>
                </div>

                <div className="bg-white shadow rounded-lg overflow-hidden w-full md:col-span-1 ">
                  <div className="w-full text-gray border-b-2 z-30 bg-white border-green-500 py-0 md:py-2 inline-flex items-center justify-center font-bold text-sm md:text-md">
                    Streak:
                  </div>
                  <div className="h-full flex items-center justify-center px-4 pb-0 -mt-3 z-10 md:pb-4 bg-gray text-gray-light text-md md:text-lg overflow-y-hidden">
                    {streak}
                  </div>
                </div>

                <div className={`shadow rounded-lg overflow-hidden w-full col-span-1 md:col-span-1 border ${currentTurn === 'White' ? 'bg-white border-black' : 'bg-black border-white'}`}>
                  <div className={`w-full py-0 md:py-2 inline-flex items-center justify-center font-bold text-sm md:text-md my-auto h-full ${currentTurn === 'White' ? 'text-black' : 'text-white'}`}>
                    {currentTurn} to move
                  </div>
                </div>

                <button
                  className="w-full bg-white text-gray-800 rounded border-b-2 border-green-500 hover:border-green-500 hover:bg-green-500 hover:text-white shadow-md py-2 px-6 inline-flex items-center "
                  onClick={resetBoard}
                >
                  <div className="flex w-6 h-6 mx-auto my-auto">
                    <img src={"/img/retry.png"} alt="retry" className="flex-none" />
                  </div>
                </button>

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
          <Article
            title="About Chesser Guesser"
          >
            <Subarticle
              subtitle=""
            >
              <p>
                Challenge yourself to guess the computer's evaluation of chess positions. Your goal is to estimate the position's value as accurately as possible -- extending your streak if you correctly guess the player ahead.
              </p>
              <p>
                Each correct guess extends your streak. See how long you can maintain it by matching or closely approximating the computer's precision. It's a test of your chess judgment against the engine's calculations. Keep your streak going and sharpen your evaluative skills!
              </p>
            </Subarticle>
          </Article>
        </div>
      </main>
      <Footer />
    </div>
  );
}