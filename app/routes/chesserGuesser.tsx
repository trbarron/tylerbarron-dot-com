import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate, useLoaderData, ScrollRestoration, type LinksFunction } from "react-router";
import { Chess } from 'chess.js';
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import { Subarticle } from "~/components/Subarticle";

// Import images
import whiteKingImage from '~/images/ChesserGuesser/whiteKing.png';
import blackKingImage from '~/images/ChesserGuesser/blackKing.png';

// Import new components
import { ModeSwitcher } from "~/components/ChesserGuesser/ModeSwitcher";
import { UsernameModal } from "~/components/ChesserGuesser/UsernameModal";
import { DailyProgressTracker } from "~/components/ChesserGuesser/DailyProgressTracker";
import { Leaderboard } from "~/components/ChesserGuesser/Leaderboard";
import { EndlessModePrompt } from "~/components/ChesserGuesser/EndlessModePrompt";
import { ModeIndicator } from "~/components/ChesserGuesser/ModeIndicator";
import { DailyCompletionMessage } from "~/components/ChesserGuesser/DailyCompletionMessage";
import { LeaderboardModal } from "~/components/ChesserGuesser/LeaderboardModal";
import { EndlessProgressTracker } from "~/components/ChesserGuesser/EndlessProgressTracker";

// Import utilities
import type { GameMode, ChessPuzzle, DailyPuzzleSet, DailyGameState } from "~/utils/chesserGuesser/types";
import { calculatePuzzleScore } from "~/utils/chesserGuesser/puzzleSelection";
import { getTodayDateString } from "~/utils/chesserGuesser/seededRandom";
import {
  loadUsername,
  saveUsername,
  loadDailyState,
  saveDailyState,
  incrementEndlessCount,
  getEndlessCount,
  shouldShowEndlessPrompt,
  dismissEndlessPrompt,
  loadMaxStreak,
  saveMaxStreak,
} from "~/utils/chesserGuesser/localStorage";

const Chessboard = lazy(() => import('~/components/Chessboard'));
import chessgroundBase from '../styles/chessground.base.css?url';
import chessgroundBrown from '../styles/chessground.brown.css?url';
import chessgroundCburnett from '../styles/chessground.cburnett.css?url';

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

  // Game mode state
  const [gameMode, setGameMode] = useState<GameMode>('endless');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [username, setUsername] = useState<string>('');

  // Endless mode state
  const [, setChess] = useState(new Chess(loaderData.randomFEN));
  const [fen, setFen] = useState(loaderData.randomFEN);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(getCurrentPlayer(loaderData.randomFEN).toLowerCase() as "white" | "black");
  const [sliderValue, setSliderValue] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(getCurrentPlayer(loaderData.randomFEN));
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [lastSlider, setLastSlider] = useState(0);
  const [lastEval, setLastEval] = useState(0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Daily mode state
  const [dailyPuzzles, setDailyPuzzles] = useState<ChessPuzzle[]>([]);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0);
  const [dailyGameState, setDailyGameState] = useState<DailyGameState | null>(null);
  const [dailyTotalScore, setDailyTotalScore] = useState(0);
  const [lastDailyScore, setLastDailyScore] = useState<number | undefined>(undefined);
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);

  // Endless mode prompt state
  const [showEndlessPrompt, setShowEndlessPrompt] = useState(false);

  // Initialize on mount
  useEffect(() => {
    // Load username if exists
    const savedUsername = loadUsername();
    if (savedUsername) {
      setUsername(savedUsername);
    }

    // Check for daily state
    const savedDailyState = loadDailyState();
    if (savedDailyState && !savedDailyState.completed) {
      // Resume daily game
      setDailyGameState(savedDailyState);
      setCurrentPuzzleIndex(savedDailyState.attempts.length);
      setDailyTotalScore(savedDailyState.totalScore);
    }

    // Load max streak
    setMaxStreak(loadMaxStreak());
  }, []);

  // Update puzzle when loader data changes (endless mode)
  useEffect(() => {
    if (gameMode === 'endless') {
      setChess(new Chess(loaderData.randomFEN));
      setFen(loaderData.randomFEN);
      setBoardOrientation(getCurrentPlayer(loaderData.randomFEN).toLowerCase() as "white" | "black");
      setCurrentTurn(getCurrentPlayer(loaderData.randomFEN));
      setIsSubmitting(false);
    }
  }, [loaderData.randomFEN, gameMode]);

  // Load daily puzzles when switching to daily mode
  useEffect(() => {
    if (gameMode === 'daily' && dailyPuzzles.length === 0) {
      loadDailyPuzzles();
    }
  }, [gameMode]);

  // Update current puzzle for daily mode
  useEffect(() => {
    if (gameMode === 'daily' && dailyPuzzles.length > 0 && currentPuzzleIndex < dailyPuzzles.length) {
      const puzzle = dailyPuzzles[currentPuzzleIndex];
      setChess(new Chess(puzzle.fen));
      setFen(puzzle.fen);
      setBoardOrientation(getCurrentPlayer(puzzle.fen).toLowerCase() as "white" | "black");
      setCurrentTurn(getCurrentPlayer(puzzle.fen));
      setSliderValue(0);
      setIsSubmitting(false);
    }
  }, [gameMode, dailyPuzzles, currentPuzzleIndex]);

  const loadDailyPuzzles = async () => {
    try {
      setIsDailyLoading(true);
      setDailyError(null);

      const response = await fetch(`/api/chesserGuesser/puzzles?date=${getTodayDateString()}`);
      if (!response.ok) {
        throw new Error(`Failed to load daily puzzles: ${response.status}`);
      }

      const data: DailyPuzzleSet = await response.json();

      if (!data.puzzles || data.puzzles.length !== 4) {
        throw new Error('Invalid puzzle data received');
      }

      setDailyPuzzles(data.puzzles);

      // Initialize daily game state if not exists
      if (!dailyGameState) {
        const newState: DailyGameState = {
          username,
          date: getTodayDateString(),
          attempts: [],
          totalScore: 0,
          completed: false,
        };
        setDailyGameState(newState);
        saveDailyState(newState);
      }

      setIsDailyLoading(false);
    } catch (error) {
      console.error('Error loading daily puzzles:', error);
      setDailyError(error instanceof Error ? error.message : 'Failed to load puzzles');
      setIsDailyLoading(false);
      // Fallback to endless mode
      setGameMode('endless');
    }
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSliderValue(Number(event.target.value));
  };

  const handleModeChange = (newMode: GameMode) => {
    if (newMode === 'daily') {
      // Check if username is set
      const savedUsername = loadUsername();
      if (!savedUsername) {
        setShowUsernameModal(true);
        return;
      }
      setUsername(savedUsername);
    }

    setGameMode(newMode);
    setSliderValue(0);
    setLastSlider(0);
    setLastEval(0);
  };

  const handleUsernameSubmit = (newUsername: string) => {
    setUsername(newUsername);
    saveUsername(newUsername);
    setShowUsernameModal(false);
    setGameMode('daily');
  };

  async function submitGuess() {
    if (isSubmitting) return;

    setIsSubmitting(true);

    if (gameMode === 'endless') {
      await submitEndlessGuess();
    } else {
      await submitDailyGuess();
    }
  }

  async function submitEndlessGuess() {
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
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak > maxStreak) {
        setMaxStreak(newStreak);
        saveMaxStreak(newStreak);
      }
    } else {
      setStreak(0);
    }

    setLastEval(loaderData.evalScore / 100);
    setLastSlider(sliderValue / 100);

    // Increment endless count and check for prompt
    const count = incrementEndlessCount();
    if (shouldShowEndlessPrompt()) {
      setShowEndlessPrompt(true);
    }

    navigate(".", { replace: true });
  }

  async function submitDailyGuess() {
    if (!dailyGameState || currentPuzzleIndex >= dailyPuzzles.length) {
      setIsSubmitting(false);
      return;
    }

    const currentPuzzle = dailyPuzzles[currentPuzzleIndex];
    const score = calculatePuzzleScore(sliderValue, currentPuzzle.eval);

    try {
      // Submit to backend
      const response = await fetch('/api/chesserGuesser/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          date: getTodayDateString(),
          puzzleIndex: currentPuzzleIndex,
          guess: sliderValue,
          actualEval: currentPuzzle.eval,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to submit score');
      }

      const result = await response.json();

      // Update local state
      const newAttempt = {
        puzzleIndex: currentPuzzleIndex,
        guess: sliderValue,
        actualEval: currentPuzzle.eval,
        score,
        timestamp: Date.now(),
      };

      const isLastPuzzle = currentPuzzleIndex === 3;

      const updatedState: DailyGameState = {
        ...dailyGameState,
        attempts: [...dailyGameState.attempts, newAttempt],
        totalScore: result.totalScore,
        completed: isLastPuzzle, // Last puzzle
      };

      setDailyGameState(updatedState);
      saveDailyState(updatedState);

      setDailyTotalScore(result.totalScore);
      setLastDailyScore(score);
      setLastEval(currentPuzzle.eval / 100);
      setLastSlider(sliderValue / 100);

      // Move to next puzzle or finish
      if (!isLastPuzzle) {
        setTimeout(() => {
          setCurrentPuzzleIndex(currentPuzzleIndex + 1);
          setSliderValue(0); // Reset slider for next puzzle
          setIsSubmitting(false);
        }, 1500);
      } else {
        // Daily game completed - show final state
        setIsSubmitting(false);
        setShowLeaderboardModal(true);
      }
    } catch (error) {
      console.error('Error submitting daily guess:', error);
      alert(error instanceof Error ? error.message : 'Failed to submit score. Please try again.');
      setIsSubmitting(false);
    }
  }



  function getCurrentPlayer(fen: string) {
    const parts = fen.split(' ');
    const turnIndicator = parts[1];
    return turnIndicator === 'w' ? 'White' : 'Black';
  }

  const isDailyCompleted = dailyGameState?.completed || (gameMode === 'daily' && currentPuzzleIndex >= 4);

  return (
    <div className="bg-black  bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <ScrollRestoration getKey={(location) => location.pathname} />
      <main className="flex-grow">
        <Article title="Chesser Guesser" subtitle="">
          {/* Mode Switcher */}
          <ModeSwitcher
            currentMode={gameMode}
            onModeChange={handleModeChange}
            disabled={isSubmitting}
          />

          {/* Endless Mode Prompt */}
          {showEndlessPrompt && gameMode === 'endless' && (
            <EndlessModePrompt
              onTryRanked={() => {
                dismissEndlessPrompt();
                setShowEndlessPrompt(false);
                handleModeChange('daily');
              }}
              onDismiss={() => {
                dismissEndlessPrompt();
                setShowEndlessPrompt(false);
              }}
              gamesPlayed={getEndlessCount()}
            />
          )}

          {/* Daily Loading State */}
          {gameMode === 'daily' && isDailyLoading && (
            <div className="bg-white  border-4 border-black  p-6 mb-4 text-center">
              <div className="font-neo text-black ">
                Loading daily puzzles...
              </div>
            </div>
          )}

          {/* Daily Error State */}
          {gameMode === 'daily' && dailyError && (
            <div className="bg-red-100  border-4 border-red-500  p-4 mb-4">
              <p className="font-neo text-red-800  font-bold mb-2">
                Error Loading Puzzles
              </p>
              <p className="font-neo text-red-800  text-sm">
                {dailyError}
              </p>
            </div>
          )}

          {/* Daily Completion Message */}
          {gameMode === 'daily' && isDailyCompleted && (
            <DailyCompletionMessage
              totalScore={dailyTotalScore}
            />
          )}

          <div className="pb-6 mx-auto grid gap-x-4 grid-cols-1 md:grid-cols-5 md:ml-auto -mx-2 md:mx-2">
            <div className="w-100% col-span-1 md:col-span-4">
              {/* Mode Indicator */}
              <div className="mb-4">
                <ModeIndicator mode={gameMode} />
              </div>

              {/* Chessboard */}
              <Suspense fallback={<div className="w-full aspect-square bg-gray-100  rounded flex items-center justify-center text-black  font-neo">Loading chessboard...</div>}>
                <Chessboard
                  initialFen={fen}
                  movable={false}
                  allowDrawing={true}
                  orientation={boardOrientation}
                />
              </Suspense>

              {/* Slider */}
              <div className="gap-2 flex w-full mt-4">
                <img src={blackKingImage} alt="Black King" className="w-12 h-12 flex-none" />
                <input
                  type="range"
                  min="-400"
                  max="400"
                  value={sliderValue}
                  onChange={handleSliderChange}
                  className="range flex-auto cursor-pointer appearance-none bg-black h-2 my-auto  border-2 border-black "
                  disabled={isDailyCompleted}
                />
                <img src={whiteKingImage} alt="White King" className="w-12 h-12 flex-none" />
              </div>

              {/* Submit Button */}
              <button
                className="w-full bg-white  text-black  border-4 border-black  px-6 py-3 font-extrabold uppercase tracking-wide hover:bg-accent  hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center font-neo mt-4"
                onClick={submitGuess}
                disabled={isSubmitting || isDailyCompleted}
              >
                <span className="text-sm">
                  {isSubmitting ? 'Loading...' : isDailyCompleted ? 'Daily Complete!' : 'Submit'}
                </span>
                <span className="text-sm">
                  {(sliderValue / 100).toFixed(2)}
                </span>
              </button>
            </div>

            {/* Sidebar */}
            <div className="justify-center text-center grid gap-y-3 h-auto md:h-full md:grid-cols-1 w-full grid-cols-3 col-span-1 md:col-span-1 gap-x-4 py-2 md:py-0">
              {/* Daily Progress Tracker (only in daily mode) */}
              {gameMode === 'daily' && (
                <div className="col-span-3 md:col-span-1">
                  <DailyProgressTracker
                    currentPuzzle={currentPuzzleIndex}
                    completedPuzzles={dailyGameState?.attempts.length || 0}
                    totalScore={dailyTotalScore}
                    lastPuzzleScore={lastDailyScore}
                  />
                </div>
              )}

              {/* Endless Progress Tracker (only in endless mode) */}
              {gameMode === 'endless' && (
                <div className="col-span-3 md:col-span-1">
                  <EndlessProgressTracker
                    streak={streak}
                    gamesPlayed={getEndlessCount()}
                    maxStreak={maxStreak}
                  />
                </div>
              )}

              {/* Last Round Info */}
              <div className="bg-white  border-4 border-black  overflow-hidden w-full col-span-3 md:col-span-1 md:h-64 h-48">
                <div className="w-full border-b-2 border-accent py-0 md:py-2 inline-flex items-center justify-center text-sm md:text-md font-neo font-bold uppercase text-black  bg-white ">
                  Last Round:
                </div>
                <div className="flex items-center justify-center px-4 py-0 md:py-2 bg-white  text-black  text-xs md:text-xs h-full overflow-y-hidden font-neo">
                  Answer: {lastEval.toFixed(2)} <br />
                  Guess: {lastSlider.toFixed(2)} <br /><br />
                  Difference: {(lastEval - lastSlider).toFixed(2)} <br /><br />

                </div>
              </div>



              {/* Turn Indicator */}
              <div className={`border-4 overflow-hidden w-full col-span-1 md:col-span-1 ${currentTurn === 'White' ? 'bg-white border-black ' : 'bg-black border-black '}`}>
                <div className={`w-full py-0 md:py-2 inline-flex items-center justify-center text-sm md:text-md my-auto h-full font-neo font-bold uppercase ${currentTurn === 'White' ? 'text-black' : 'text-white'}`}>
                  {currentTurn} to move
                </div>
              </div>


            </div>
          </div>
        </Article>

        {/* Leaderboard Section */}
        <Article title="Daily Leaderboard" subtitle="" styleModifier="pb-6">
          <Leaderboard
            currentUsername={username}
            date={getTodayDateString()}
          />
        </Article>

        {/* About Section */}
        <Article title="About Chesser Guesser" subtitle="">
          <Subarticle subtitle="Overview">
            <p>Inspired by GeoGuessr, Chesser Guesser challenges players to estimate the computer&apos;s evaluation of chess positions. Players try to estimate the value of specific chess positions as accurately as possible, matching or closely approximating the engine&apos;s evaluation to extend their streak. The goal is to sharpen your evaluative skills by understanding why certain positions are deemed advantageous or disadvantageous by the computer.</p>
            <p className="mt-4"><strong>Ranked Mode:</strong> Compete on the daily leaderboard! Everyone gets the same 4 puzzles each day (1 easy, 1 medium, 1 hard, 1 expert). Earn up to 400 points total and see how you rank globally.</p>
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

      {/* Username Modal */}
      <UsernameModal
        isOpen={showUsernameModal}
        initialUsername={username}
        onSubmit={handleUsernameSubmit}
        onCancel={() => setShowUsernameModal(false)}
      />

      {/* Leaderboard Modal */}
      <LeaderboardModal
        isOpen={showLeaderboardModal}
        onClose={() => setShowLeaderboardModal(false)}
        username={username}
        date={getTodayDateString()}
      />
    </div>
  );
}
