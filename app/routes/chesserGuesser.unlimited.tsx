import { useState, useEffect } from "react";
import { useNavigate, useLoaderData, ScrollRestoration } from "react-router";
import { Chess } from 'chess.js';
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import { Subarticle } from "~/components/Subarticle";

// Import images
import whiteKingImage from '~/images/ChesserGuesser/whiteKing.png';
import blackKingImage from '~/images/ChesserGuesser/blackKing.png';

import Chessboard from '~/components/Chessboard';
import chessgroundBase from '../styles/chessground.base.css?url';
import chessgroundBrown from '../styles/chessground.brown.css?url';
import chessgroundCburnett from '../styles/chessground.cburnett.css?url';

export const links = () => [
  { rel: 'stylesheet', href: chessgroundBase },
  { rel: 'stylesheet', href: chessgroundBrown },
  { rel: 'stylesheet', href: chessgroundCburnett }
];

type LoaderData = {
  randomFEN: string;
  evalScore: number;
  error?: string;
};

export const loader = async () => {
  try {
    const response = await fetch('https://f73vgbj1jk.execute-api.us-west-2.amazonaws.com/prod/chesserGuesser');
    const data = await response.json();
    const parsedBody = JSON.parse(data.body);
    
    return Response.json({
      randomFEN: parsedBody.fen,
      evalScore: parseInt(parsedBody.eval),
    });
  } catch (error) {
    console.error("Error fetching position:", error);
    return Response.json({
      randomFEN: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      evalScore: 0,
      error: 'Failed to fetch position'
    });
  }
};

export default function ChesserGuesserUnlimited() {
  const loaderData = useLoaderData<LoaderData>();
  const navigate = useNavigate();

  const [, setChess] = useState(new Chess(loaderData.randomFEN));
  const [fen, setFen] = useState(loaderData.randomFEN);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(getCurrentPlayer(loaderData.randomFEN).toLowerCase() as "white" | "black");
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
    setBoardOrientation(getCurrentPlayer(loaderData.randomFEN).toLowerCase() as "white" | "black");
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
      replace: true
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
        <Article title="Chesser Guesser" subtitle="">
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
                    className="range flex-auto cursor-pointer appearance-none bg-black h-2 my-auto rounded-lg"
                  />
                  <img src={whiteKingImage} alt="White King" className="w-12 h-12 flex-none" />
                </div>

                <button
                  className="w-full bg-white text-black border-4 border-black px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-black hover:text-white transition-all duration-100 flex flex-col items-center"
                  onClick={submitGuess}
                >
                  <span className="text-sm">
                    Submit
                  </span>
                  <span className="text-sm">
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
        <Article title="About Chesser Guesser" subtitle="">
          <Subarticle subtitle="Overview">
            <p>Inspired by GeoGuessr, Chesser Guesser challenges players to estimate the computer&apos;s evaluation of chess positions. Players try to estimate the value of specific chess positions as accurately as possible, matching or closely approximating the engine&apos;s evaluation to extend their streak. The goal is to sharpen your evaluative skills by understanding why certain positions are deemed advantageous or disadvantageous by the computer.</p>
          </Subarticle>
          <Subarticle subtitle="The Analysis">
            <p>The game integrates with the <a href='https://lichess.org/@/lichess/blog/thousands-of-stockfish-analysers/WN-gLzAA'>Lichess Cloud Analysis</a> to fetch position evaluations at scale, giving access to all the positions and their evaluations without me having to do any work. Having this resource made the tough part of this project incredibly easy.</p>

            <p>Chesser Guesser uses Python connected to several Amazon DynamoDB instances for data storage. Lichess gives us a huge number of analyzed positions – we get to parse those down and only insert the interesting ones for our game. The criteria used was: </p>
            <p className='pl-8'>- The evaluation is not above 400 centipawns (a centipawn is a unit of advantage, with 100 ~= 1 pawn&apos;s advantage) in either direction or between -50 and 50 centipawns</p>
            <p className='pl-8'>- The same number of entries must be given for both the black and white side</p>
            <p className='pl-8'>- There are less than 5 pawns on any rank, to remove most analysis being on openings</p>
            <p>A total of 400 evaluations were added, although thousands meet the criteria and there are over a million with saved analysis</p>
          </Subarticle>
          <Subarticle subtitle="The UI">
            <p>For the chess board I used the open source <a href='https://github.com/lichess-org/chessground/tree/master'>Chessground</a>. I&apos;ve used it before and gotta say, its the best. Again, thank you to Lichess for providing these resources! </p>
            <p>Sliders and such were able to be reused from another, now defunct project. I made a few improvements to help with it on mobile (75+% of users are mobile users) which is always great.</p>
          </Subarticle>
          <Subarticle subtitle="Reception">
            <p>This was released on the afternoon of March 17th 2024. It did really well on /r/chess, getting 40+k views, 50+ comments and a 95+% upvote rate. This spurred me to rush to implement Google Analytics where I could see the global engagement. Over one thousand people have since played, including a few titled players.</p>
            <p>Overall I would consider this experiment a success, hosting a lot of traffic and some fun conversations.</p>
          </Subarticle>
        </Article>
      </main>
      <Footer />
    </div>
  );
}