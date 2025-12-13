import { useState, useEffect, lazy, Suspense } from "react";
import { useNavigate, useLoaderData, ScrollRestoration, type LinksFunction } from "react-router";
import { Chess } from 'chess.js';
import { Navbar } from "~/components/Navbar";
import Footer from "~/components/Footer";
import Article from "~/components/Article";
import { Subarticle } from "~/components/Subarticle";

const blackKingImage = getImageUrl('ChesserGuesser/blackKing.png');
const whiteKingImage = getImageUrl('ChesserGuesser/whiteKing.png');
// Import images
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
import { getImageUrl } from '~/utils/cdn';

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

  // Review mode state
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [reviewPuzzleIndex, setReviewPuzzleIndex] = useState(0);
  const [puzzleHistory, setPuzzleHistory] = useState<Array<{
    fen: string;
    eval: number;
    guess: number;
    timestamp: number;
    mode: GameMode;
  }>>([]);
  const [copyFeedback, setCopyFeedback] = useState(false);

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

  // Exit review mode when switching game modes
  useEffect(() => {
    if (isReviewMode) {
      setIsReviewMode(false);
      setReviewPuzzleIndex(0);
    }
  }, [gameMode]);

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

      // Use fallback puzzles for local development
      const fallbackPuzzles: ChessPuzzle[] = [
        {
          fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4',
          eval: 50,
          difficulty: 'easy'
        },
        {
          fen: '4r1k1/pp3ppp/2p5/2b5/4PB2/2P2P2/P5PP/3R2K1 w - - 0 1',
          eval: -125,
          difficulty: 'medium'
        },
        {
          fen: '2r3k1/5ppp/p3p3/1p1pP3/3P4/1P2QP2/P5PP/3q2K1 w - - 0 1',
          eval: 280,
          difficulty: 'hard'
        },
        {
          fen: '6k1/5ppp/4p3/3pP3/3P4/5P2/6PP/6K1 b - - 0 1',
          eval: -15,
          difficulty: 'expert'
        }
      ];

      console.warn('Using fallback puzzles for development');
      setDailyPuzzles(fallbackPuzzles);
      setDailyError('⚠️ Using development puzzles (API unavailable)');

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

  const toggleReviewMode = () => {
    // Filter history by current mode
    const currentModeHistory = puzzleHistory.filter(p => p.mode === gameMode);
    if (currentModeHistory.length === 0) return; // Can't review if no history for current mode

    if (!isReviewMode) {
      // Entering review mode - start at most recent (index 0)
      setIsReviewMode(true);
      setReviewPuzzleIndex(0);
    } else {
      // Exiting review mode
      setIsReviewMode(false);
    }
  };

  const navigateReviewPuzzle = (direction: 'prev' | 'next', filteredHistory: typeof puzzleHistory) => {
    if (direction === 'prev' && reviewPuzzleIndex > 0) {
      setReviewPuzzleIndex(reviewPuzzleIndex - 1);
    } else if (direction === 'next' && reviewPuzzleIndex < filteredHistory.length - 1) {
      setReviewPuzzleIndex(reviewPuzzleIndex + 1);
    }
  };

  const copyFEN = async (fen: string) => {
    try {
      await navigator.clipboard.writeText(fen);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000); // Hide after 2 seconds
    } catch (err) {
      console.error('Failed to copy FEN:', err);
      // Fallback: show FEN in alert only on error
      alert(`Could not copy. FEN: ${fen}`);
    }
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

    // Add to puzzle history (keep last 15 for endless mode)
    setPuzzleHistory(prev => {
      const newEntry = {
        fen: loaderData.randomFEN,
        eval: loaderData.evalScore,
        guess: sliderValue,
        timestamp: Date.now(),
        mode: 'endless' as GameMode,
      };
      const updated = [newEntry, ...prev];
      return updated.slice(0, 15); // Keep only last 15 for endless mode
    });

    // Increment endless count and check for prompt
    incrementEndlessCount();
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

      // Add to puzzle history (keep last 4 for daily mode)
      setPuzzleHistory(prev => {
        const newEntry = {
          fen: currentPuzzle.fen,
          eval: currentPuzzle.eval,
          guess: sliderValue,
          timestamp: Date.now(),
          mode: 'daily' as GameMode,
        };
        const updated = [newEntry, ...prev];
        // For daily mode, keep only the 4 puzzles from today
        const dailyPuzzles = updated.filter(p => p.mode === 'daily').slice(0, 4);
        const endlessPuzzles = updated.filter(p => p.mode === 'endless');
        return [...dailyPuzzles, ...endlessPuzzles];
      });

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

  // Filter history by current game mode
  const allModeHistory = puzzleHistory.filter(p => p.mode === gameMode);
  const totalCount = allModeHistory.length;

  // For display, limit to most recent 15 (for endless) or 4 (for daily)
  const displayLimit = gameMode === 'endless' ? 15 : 4;
  const filteredHistory = allModeHistory.slice(0, displayLimit);

  // Calculate display number (most recent = highest number)
  const displayPuzzleNumber = totalCount - reviewPuzzleIndex;

  // Determine what to display (current puzzle or review puzzle)
  const displayFen = isReviewMode && filteredHistory.length > 0
    ? filteredHistory[reviewPuzzleIndex].fen
    : fen;

  const displayOrientation = isReviewMode && filteredHistory.length > 0
    ? (getCurrentPlayer(filteredHistory[reviewPuzzleIndex].fen).toLowerCase() as "white" | "black")
    : boardOrientation;

  const reviewPuzzle = isReviewMode && filteredHistory.length > 0 ? filteredHistory[reviewPuzzleIndex] : null;

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
              {/* Mode Indicator and Turn Indicator */}
              <div className="mb-4 flex gap-2 items-stretch">
                <div className="flex-grow">
                  <ModeIndicator mode={gameMode} />
                </div>
                <div className={`border-2 border-black  px-3 md:px-4 py-1 md:py-2 flex items-center justify-center ${
                  currentTurn === 'White' ? 'bg-white text-black' : 'bg-black text-white'
                }`}>
                  <span className="font-neo font-bold text-xs md:text-sm uppercase whitespace-nowrap">
                    {currentTurn} to move
                  </span>
                </div>
              </div>


              {/* Chessboard */}
              <Suspense fallback={<div className="w-full aspect-square bg-gray-100  rounded flex items-center justify-center text-black  font-neo">Loading chessboard...</div>}>
                <Chessboard
                  key={displayFen} // Force re-render when FEN changes
                  initialFen={displayFen}
                  movable={false}
                  allowDrawing={!isReviewMode}
                  orientation={displayOrientation}
                />
              </Suspense>

              {/* Slider - Hidden in review mode */}
              {!isReviewMode && (
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
              )}

              {/* Submit Button - Hidden in review mode */}
              {!isReviewMode && (
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
              )}
            </div>

            {/* Sidebar */}
            <div className="justify-center text-center grid gap-y-3 h-auto md:h-full md:grid-cols-1 w-full grid-cols-3 col-span-1 md:col-span-1 gap-x-4 py-2 md:py-0">
              {/* Last Round Info / Review Puzzle Info - First on mobile */}
              {((lastEval !== 0 || lastSlider !== 0) || (isReviewMode && reviewPuzzle)) && (
                <div className="bg-white  border-4 border-black  overflow-hidden w-full col-span-3 md:col-span-1">
                  {/* Header */}
                  <div className="w-full border-b-2 border-accent  py-2 flex flex-col items-center justify-center font-neo font-bold uppercase text-black  bg-white ">
                    <span className="text-xs md:text-sm">
                      {isReviewMode ? `Puzzle #${displayPuzzleNumber} of ${totalCount}` : gameMode === 'daily' && lastDailyScore !== undefined ? `Puzzle #${currentPuzzleIndex} Complete` : 'Last Round'}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-3 md:p-4 bg-white  text-black  font-neo space-y-2">
                    {/* Navigation buttons in review mode */}
                    {isReviewMode && reviewPuzzle && (
                      <div className="flex gap-1 mb-2">
                        <button
                          onClick={() => navigateReviewPuzzle('prev', filteredHistory)}
                          disabled={reviewPuzzleIndex === 0}
                          className="flex-1 px-1 py-1 bg-black  text-white  text-[10px] md:text-xs font-bold disabled:opacity-30"
                        >
                          ← New
                        </button>
                        <button
                          onClick={() => navigateReviewPuzzle('next', filteredHistory)}
                          disabled={reviewPuzzleIndex === filteredHistory.length - 1}
                          className="flex-1 px-1 py-1 bg-black  text-white  text-[10px] md:text-xs font-bold disabled:opacity-30"
                        >
                          Old →
                        </button>
                      </div>
                    )}

                    {/* Stats - shown in both modes */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-left">
                        <div className="text-gray-600  uppercase text-[10px]">Your Guess</div>
                        <div className="font-bold text-sm">
                          {isReviewMode && reviewPuzzle
                            ? (reviewPuzzle.guess / 100).toFixed(2)
                            : lastSlider.toFixed(2)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-gray-600  uppercase text-[10px]">Actual</div>
                        <div className="font-bold text-sm">
                          {isReviewMode && reviewPuzzle
                            ? (reviewPuzzle.eval / 100).toFixed(2)
                            : lastEval.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {/* Difference */}
                    <div className="border-t-2 border-gray-200  pt-2">
                      <div className="text-gray-600  uppercase text-[10px]">Difference</div>
                      <div className="font-bold text-lg text-accent ">
                        {isReviewMode && reviewPuzzle
                          ? Math.abs((reviewPuzzle.eval - reviewPuzzle.guess) / 100).toFixed(2)
                          : Math.abs(lastEval - lastSlider).toFixed(2)}
                      </div>
                    </div>

                    {/* Score (Daily mode only) */}
                    {gameMode === 'daily' && (
                      <div className="border-t-2 border-gray-200  pt-2">
                        <div className="text-gray-600  uppercase text-[10px]">Score</div>
                        <div className="font-bold text-lg text-green-600 ">
                          {isReviewMode && reviewPuzzle && dailyGameState
                            ? (() => {
                                const attempt = dailyGameState.attempts.find(
                                  a => Math.abs(a.guess - reviewPuzzle.guess) < 1 && Math.abs(a.actualEval - reviewPuzzle.eval) < 1
                                );
                                return attempt ? `${attempt.score}/100` : '-';
                              })()
                            : lastDailyScore !== undefined
                              ? `${lastDailyScore}/100`
                              : '-'}
                        </div>
                      </div>
                    )}

                    {/* Showing count indicator in review mode */}
                    {isReviewMode && totalCount > displayLimit && (
                      <div className="text-center text-gray-600  text-[10px] pt-1">
                        (Showing last {displayLimit} of {totalCount})
                      </div>
                    )}

                    {/* Copy FEN and Exit Review buttons in review mode */}
                    {isReviewMode && reviewPuzzle && (
                      <div className="space-y-1 mt-2">
                        <button
                          onClick={() => copyFEN(reviewPuzzle.fen)}
                          className={`w-full px-2 py-1 text-[10px] font-bold transition-colors ${
                            copyFeedback
                              ? 'bg-green-600  text-white '
                              : 'bg-gray-200  text-gray-700  hover:bg-gray-300 '
                          }`}
                        >
                          {copyFeedback ? '✓ FEN Copied' : '📋 Copy FEN to Clipboard'}
                        </button>
                        <button
                          onClick={toggleReviewMode}
                          className="w-full px-3 py-2 bg-accent  text-white  font-bold text-xs hover:bg-black  transition-colors"
                        >
                          Exit Review
                        </button>
                      </div>
                    )}

                    {/* View All button in normal mode */}
                    {totalCount > 0 && !isReviewMode && (
                      <button
                        onClick={toggleReviewMode}
                        className="w-full mt-2 px-3 py-2 bg-black  text-white  font-bold text-xs hover:bg-accent  transition-colors"
                      >
                        View All Puzzles →
                      </button>
                    )}
                  </div>
                </div>
              )}

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
