import React, { useState, Suspense, useEffect } from "react";
import { useNavigate, useLoaderData, Form, ScrollRestoration, useLocation } from "@remix-run/react";
import { Chess } from 'chess.js';
import { json } from "@remix-run/node";
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import { Subarticle } from "~/components/Subarticle";

// Import images
import whiteKingImage from '~/images/ChesserGuesser/whiteKing.png';
import blackKingImage from '~/images/ChesserGuesser/blackKing.png';

import type { LinksFunction, LoaderFunction } from '@remix-run/node';
import Chessboard from '~/components/Chessboard';
import chessgroundBase from '../styles/chessground.base.css';
import chessgroundBrown from '../styles/chessground.brown.css';
import chessgroundCburnett from '../styles/chessground.cburnett.css';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: chessgroundBase },
  { rel: 'stylesheet', href: chessgroundBrown },
  { rel: 'stylesheet', href: chessgroundCburnett }
];

type LoaderData = {
  randomFEN: string;
  evalScore: number;
  error?: string;
};

export const loader: LoaderFunction = async () => {
  try {
    const response = await fetch('https://f73vgbj1jk.execute-api.us-west-2.amazonaws.com/prod/chesserGuesser');
    const data = await response.json();
    const parsedBody = JSON.parse(data.body);
    
    return json({
      randomFEN: parsedBody.fen,
      evalScore: parseInt(parsedBody.eval),
    });
  } catch (error) {
    console.error("Error fetching position:", error);
    return json({
      randomFEN: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      evalScore: 0,
      error: 'Failed to fetch position'
    });
  }
};

export default function ChesserGuesserUnlimited() {
  const loaderData = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  const [chess, setChess] = useState(new Chess(loaderData.randomFEN));
  const [fen, setFen] = useState(loaderData.randomFEN);
  const [boardOrientation, setBoardOrientation] = useState(getCurrentPlayer(loaderData.randomFEN).toLowerCase());
  const [sliderValue, setSliderValue] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(getCurrentPlayer(loaderData.randomFEN));
  const [streak, setStreak] = useState(0);
  const [lastSlider, setLastSlider] = useState(0);
  const [lastEval, setLastEval] = useState(0);
  const [positiveMessage, setPositiveMessage] = useState(getPositiveMessage());
  const [negativeMessage, setNegativeMessage] = useState(getNegativeMessage());

  useEffect(() => {
    setChess(new Chess(loaderData.randomFEN));
    setFen(loaderData.randomFEN);
    setBoardOrientation(getCurrentPlayer(loaderData.randomFEN).toLowerCase());
    setCurrentTurn(getCurrentPlayer(loaderData.randomFEN));
  }, [loaderData.randomFEN]);

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(event.target.value));
  };

  function submitGuess() {
    const difference = Math.abs(loaderData.evalScore - sliderValue) / 100;
    let correctSide = false;
    if (loaderData.evalScore > 20 && sliderValue > 0) {
      correctSide = true;
    } else if (loaderData.evalScore < -20 && sliderValue < 0) {
      correctSide = true;
    } else if (loaderData.evalScore < 20 && loaderData.evalScore > -20 && sliderValue < 20 && sliderValue > -20) {
      correctSide = true;
    }

    if (correctSide) {
      setStreak(streak + 1);
      setPositiveMessage(getPositiveMessage());
    } else {
      setStreak(0);
      setNegativeMessage(getNegativeMessage());
    }

    setLastEval(loaderData.evalScore / 100);
    setLastSlider(sliderValue / 100);

    navigate(".", { 
      replace: true,
      state: { key: location.key } 
    });

    return difference;
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

  return (
    <div className="bg-background bg-fixed min-h-screen">
      <Navbar />
      <ScrollRestoration getKey={(location) => {
        // Return consistent key for this route to maintain scroll
        return location.pathname;
      }} />
      <main className="flex-grow">
        <Article title="Chesser Guesser Unlimited" subtitle="">
            <div className="pb-6 mx-auto grid gap-x-4 grid-rows-2 md:grid-rows-1 grid-cols-1 md:grid-cols-2 md:ml-auto" style={{ gridTemplateColumns: "80% 20%", marginLeft: "-0.5rem", marginRight: "0.5rem" }}>
              <div className="w-100% col-span-2 md:col-span-1">
                <Chessboard
                  initialFen={fen}
                  movable={false}
                  allowDrawing={true}
                  orientation={boardOrientation}
                />

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

              <div className="justify-center text-center grid gap-y-3 h-80 md:h-full md:grid-cols-1 w-full grid-cols-3 col-span-2 md:col-span-1 gap-x-4 py-2 md:py-0">
                <div className="bg-white shadow rounded-lg overflow-hidden w-full col-span-3 md:col-span-1 md:h-60 h-36">
                  <div className="w-full text-gray border-b-2 border-green-500 py-0 md:py-2 inline-flex items-center justify-center text-sm md:text-md">
                    Last Round:
                  </div>
                  <div className="flex items-center justify-center px-4 py-0 md:py-2 bg-gray text-gray-light text-xs md:text-xs h-full overflow-y-hidden">
                    Answer: {lastEval.toFixed(2)} <br />
                    Guess: {lastSlider.toFixed(2)} <br /><br />
                    Difference: {(lastEval - lastSlider).toFixed(2)} <br /><br />
                    {lastEval === 0 ? "" : (streak > 0 ? positiveMessage : negativeMessage)}
                  </div>
                </div>

                <div className="bg-white shadow rounded-lg overflow-hidden w-full md:col-span-1">
                  <div className="w-full text-gray border-b-2 z-30 bg-white border-green-500 py-0 md:py-2 inline-flex items-center justify-center text-sm md:text-md">
                    Streak:
                  </div>
                  <div className="h-full flex items-center justify-center px-4 pb-0 -mt-3 z-10 md:pb-4 bg-gray text-gray-light text-md md:text-lg overflow-y-hidden">
                    {streak}
                  </div>
                </div>

                <div className={`shadow rounded-lg overflow-hidden w-full col-span-1 md:col-span-1 border ${currentTurn === 'White' ? 'bg-white border-black' : 'bg-black border-white'}`}>
                  <div className={`w-full py-0 md:py-2 inline-flex items-center justify-center text-sm md:text-md my-auto h-full ${currentTurn === 'White' ? 'text-black' : 'text-white'}`}>
                    {currentTurn} to move
                  </div>
                </div>

              </div>
            </div>
        </Article>
        <div className="visible ">
          <Article
            title="About Chesser Guesser"
          >
            <Subarticle
              subtitle=""
            >
              <p>
                Challenge yourself to guess the computer's evaluation of chess positions. Your goal is to estimate the position's value as accurately as possible -- extending your streak if you correctly guess the player ahead
              </p>
              <p>
                Each correct guess extends your streak. See how long you can maintain it by matching or closely approximating the computer's precision
              </p>
            </Subarticle>
          </Article>
        </div>
      </main>
      <Footer />
    </div>
  );
}