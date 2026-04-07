import { useState, useEffect, useCallback } from 'react';
import { useLoaderData, ScrollRestoration, type LinksFunction } from 'react-router';
import { getRedisClient } from '~/utils/redis.server';
import { computePacing } from '~/utils/blunderWatch/pacing';
import { calculateScore } from '~/utils/blunderWatch/scoring';
import { Navbar } from '~/components/Navbar';
import Footer from '~/components/Footer';
import Article from '~/components/Article';
import { Subarticle } from '~/components/Subarticle';
import { UsernameModal } from '~/components/ChesserGuesser/UsernameModal';

import { GameBoard } from '~/components/BlunderWatch/GameBoard';
import { BlunderButton } from '~/components/BlunderWatch/BlunderButton';
import { ScoreBug } from '~/components/BlunderWatch/ScoreBug';
import { ResultsScreen } from '~/components/BlunderWatch/ResultsScreen';
import { BlunderReplay } from '~/components/BlunderWatch/BlunderReplay';
import { Leaderboard } from '~/components/BlunderWatch/Leaderboard';

import { usePlayback } from '~/hooks/usePlayback';
import type { BlunderWatchGame, SubmitResponse } from '~/utils/blunderWatch/types';
import { loadUsername, saveUsername, loadResult, saveResult } from '~/utils/blunderWatch/localStorage';

import chessgroundBase from '../styles/chessground.base.css?url';
import chessgroundBrown from '../styles/chessground.brown.css?url';
import chessgroundCburnett from '../styles/chessground.cburnett.css?url';

export const links: LinksFunction = () => [
  { rel: 'stylesheet', href: chessgroundBase },
  { rel: 'stylesheet', href: chessgroundBrown },
  { rel: 'stylesheet', href: chessgroundCburnett },
];

type LoaderData =
  | { game: BlunderWatchGame; error?: never }
  | { game: null; error: string };

export const loader = async () => {
  const today = new Date().toISOString().split('T')[0];
  try {
    const redis = getRedisClient();
    const raw = await redis.get(`blunderWatch:game:${today}`);
    if (!raw) {
      return Response.json({ game: null, error: `No game scheduled for ${today}. Check back soon!` });
    }
    const stored = JSON.parse(raw);
    const pacing = computePacing(stored.moves.length);
    const game: BlunderWatchGame = {
      gameNumber: parseInt(stored.gameId.replace('bw-', ''), 10),
      date: stored.date,
      whiteElo: stored.whiteElo,
      blackElo: stored.blackElo,
      moves: stored.moves,
      blunderCount: stored.blunderIndices.length,
      blunderIndices: stored.blunderIndices,
      evals: stored.evals,
      pacing,
      ...(stored.gameUrl ? { gameUrl: stored.gameUrl } : {}),
    };
    return Response.json({ game });
  } catch (err) {
    console.error('BlunderWatch loader error:', err);
    return Response.json({ game: null, error: 'Failed to load today\'s game.' });
  }
};

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function getOrientation(game: BlunderWatchGame | null): 'white' | 'black' {
  if (!game || game.moves.length === 0) return 'white';
  // The first move is always White's, so orient from White's perspective by default.
  // Could be made smarter with the starting FEN if games ever start mid-position.
  return 'white';
}

export default function BlunderWatch() {
  const { game, error } = useLoaderData<LoaderData>();
  const playback = usePlayback(game);

  const [username, setUsername] = useState('');
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [scrollToLeaderboard, setScrollToLeaderboard] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const today = getTodayDateString();

  useEffect(() => {
    const saved = loadUsername();
    if (saved) setUsername(saved);

    // Check if already played today
    const storedResult = loadResult(today);
    if (storedResult && game) {
      setAlreadyPlayed(true);
    }

    // Show how-to-play for first-time visitors
    try {
      if (!localStorage.getItem('blunderWatch:howToPlayDismissed')) {
        setShowHowToPlay(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, [today, game]);

  // Prevent spacebar from scrolling the page and trigger game flag
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable
        ) {
          return;
        }
        e.preventDefault();

        // If playing, spacebar triggers the blunder flag
        if (
          playback.phase === 'playing' &&
          playback.currentMoveIndex >= 0 &&
          !playback.hasFlaggedCurrentMove
        ) {
          playback.flagCurrentMove();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playback]);

  const submitScore = useCallback(async (overrideUsername?: string) => {
    if (!game) return;
    const submittingAs = overrideUsername ?? username;
    if (!submittingAs) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/blunderWatch/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: submittingAs,
          date: today,
          flags: playback.flags,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // 409 = already submitted — treat as informational, not a hard error
        if (res.status === 409) {
          const stored = loadResult(today);
          if (stored) {
            setAlreadyPlayed(true);
          }
          // Calculate local results so they can see the blunders anyway
          const localResult = calculateScore(playback.flags, game.blunderIndices, game.evals);
          setSubmitResult({
            ...localResult,
            rank: null,
            totalPlayers: 0,
          });
          setSubmitError(null);
          return;
        }
        throw new Error(body.error || 'Submission failed.');
      }

      const result: SubmitResponse = await res.json();
      setSubmitResult(result);

      // Persist result locally so "already played" state survives page refresh
      saveResult({
        date: today,
        score: result.totalScore,
        blundersCaught: result.blundersCaught,
        falsePositives: result.falsePositives,
        resultEmoji: result.resultEmoji,
        gameNumber: game.gameNumber,
      });
    } catch (err) {
      console.error('Submission failed, showing local results:', err);
      // Even on failure, calculate local results so they can see the blunders
      const localResult = calculateScore(playback.flags, game.blunderIndices, game.evals);
      setSubmitResult({
        ...localResult,
        rank: null,
        totalPlayers: 0,
      });
      setSubmitError(null); // Clear error since we're showing results
    } finally {
      setIsSubmitting(false);
    }
  }, [game, username, today, playback.flags]);

  // Submit flags once playback finishes
  useEffect(() => {
    if (playback.phase !== 'finished' || isSubmitting || submitResult || submitError) return;
    if (!game) return;

    if (!username) {
      setShowUsernameModal(true);
      return;
    }

    submitScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isSubmitting/submitResult/submitError are guards, not triggers
  }, [playback.phase, username, game, submitScore]);

  const handleUsernameSubmit = (newUsername: string) => {
    setUsername(newUsername);
    saveUsername(newUsername);
    setShowUsernameModal(false);
    // Now that we have a username, submit the score
    submitScore(newUsername);
  };

  const handleGuestScore = () => {
    if (!game) return;
    const result = calculateScore(playback.flags, game.blunderIndices, game.evals);
    setSubmitResult({
      ...result,
      rank: null,
      totalPlayers: 0,
    });
    // Persist result locally so "already played" state survives page refresh
    saveResult({
      date: today,
      score: result.totalScore,
      blundersCaught: result.blundersCaught,
      falsePositives: result.falsePositives,
      resultEmoji: result.resultEmoji,
      gameNumber: game.gameNumber,
    });
    setShowUsernameModal(false);
  };

  const handleStartGame = () => {
    playback.startGame();
  };

  const dismissHowToPlay = () => {
    setShowHowToPlay(false);
    try {
      localStorage.setItem('blunderWatch:howToPlayDismissed', '1');
    } catch {
      // Ignore storage errors
    }
  };

  const orientation = getOrientation(game);
  const initialFen = STARTING_FEN;

  // Derive current turn label from move index
  const currentTurn =
    !game || playback.currentMoveIndex < 0
      ? 'White'
      : playback.currentMoveIndex % 2 === 0
        ? 'Black' // Black to move after White's move (even ply)
        : 'White';

  // Derive game end state from the final move's SAN notation
  const lastMoveSan = game?.moves[game.moves.length - 1] ?? '';
  const isCheckmate = lastMoveSan.endsWith('#');
  // Even-indexed last move = White played it; odd = Black played it
  const checkmateWinner = game && game.moves.length > 0
    ? (game.moves.length - 1) % 2 === 0 ? 'White' : 'Black'
    : 'White';

  return (
    <div className="bg-fixed min-h-screen flex flex-col">
      <Navbar />
      <ScrollRestoration getKey={loc => loc.pathname} />
      <main className="flex-grow">
        <Article title="Blunder Watch" subtitle="">

          {/* How to play — dismissable, shown once for new visitors */}
          {showHowToPlay && (
            <div className="bg-white border-4 border-black p-6 mb-6 relative">
              <button
                onClick={dismissHowToPlay}
                className="absolute top-2 right-4 font-neo font-black text-black hover:bg-black hover:text-white text-2xl leading-none transition-all duration-100 px-1"
                aria-label="Dismiss"
              >
                &times;
              </button>
              <p className="font-neo font-extrabold text-black text-sm uppercase mb-3 tracking-widest">How to play</p>
              <p className="font-neo text-base font-medium text-black pr-8">
                The game plays out automatically in front of you. Press the button (or <kbd className="bg-black text-white px-2 py-0.5 border-2 border-black font-mono text-xs font-bold uppercase">Space</kbd>) whenever White blunders — a mistake that swings the eval by 2+ pawns. The faster you react, the more points you earn. False positives cost you 30 points.
              </p>
            </div>
          )}

          {/* Error state — no game today */}
          {error && (
            <div className="bg-gray-100 border-4 border-black p-6 mb-6">
              <p className="font-neo font-extrabold text-black uppercase mb-2 tracking-widest">No Game Available</p>
              <p className="font-neo font-bold text-black text-sm uppercase">{error}</p>
            </div>
          )}

          {/* Already played today */}
          {alreadyPlayed && !submitResult && game && (
            <div className="bg-gray-100 border-4 border-black p-6 mb-6 text-center">
              <p className="font-neo font-black text-black uppercase tracking-widest text-lg">You already played today!</p>
            </div>
          )}

          {game && !alreadyPlayed && (
            <div className="pb-6">
              {/* Pregame + Playing: same grid layout */}
              {(playback.phase === 'pregame' || playback.phase === 'playing') && (
                <div className="grid gap-x-4 grid-cols-1 md:grid-cols-5">
                  {/* Sidebar — on mobile renders first (above board); on desktop, right column */}
                  <div className="col-span-1 md:col-span-1 md:order-2 mb-3 md:mb-0">
                    {playback.phase === 'pregame' ? (
                      <div className="bg-white border-4 border-black p-3 md:p-4 flex flex-row flex-wrap md:flex-col md:h-full gap-2 md:gap-0 justify-between items-center md:items-stretch">
                        {/* Matchup — horizontal on mobile, stacked on desktop */}
                        <div className="flex items-center gap-2 md:gap-4 md:block md:text-center md:mb-6">
                          <p className="hidden md:block font-neo text-[10px] font-extrabold uppercase tracking-widest text-black opacity-60 mb-3">Matchup</p>
                          <div className="flex items-center gap-2 md:justify-center">
                            <div className="w-4 h-4 md:w-5 md:h-5 bg-white border-2 border-black flex-shrink-0" />
                            <span className="font-neo font-black text-base md:text-lg">{game.whiteElo}</span>
                          </div>
                          <span className="font-neo text-black opacity-20 font-black text-lg md:text-xl md:block md:my-2">VS</span>
                          <div className="flex items-center gap-2 md:justify-center">
                            <div className="w-4 h-4 md:w-5 md:h-5 bg-black flex-shrink-0" />
                            <span className="font-neo font-black text-base md:text-lg">{game.blackElo}</span>
                          </div>
                        </div>

                        {/* Blunder count */}
                        <div className="md:border-t-4 md:border-black md:pt-6 md:mb-6 flex-shrink-0 mt-2 sm:mt-0">
                          <div className="bg-gray-100 border-4 border-black px-3 py-1.5 md:px-3 md:py-4 text-center">
                            <span className="font-neo font-black text-xl md:text-4xl md:leading-none tracking-tighter">{game.blunderCount}</span>
                            <span className="font-neo text-[10px] md:text-xs font-bold uppercase tracking-wider md:block md:mt-2 ml-1 md:ml-0">blunders</span>
                          </div>
                        </div>

                        {/* Progress placeholder — desktop only */}
                        <div className="hidden md:block mt-auto">
                          <div className="border-4 border-black h-3 bg-gray-100">
                            <div className="h-full bg-black" />
                          </div>
                          <p className="font-neo text-[10px] font-extrabold text-black opacity-60 text-center mt-2 uppercase tracking-widest whitespace-nowrap">
                            {game.moves.length} moves
                          </p>
                        </div>
                      </div>
                    ) : (
                      <ScoreBug
                        score={playback.liveScore}
                        blundersCaught={playback.flags.filter(f => game.blunderIndices.includes(f.moveIndex)).length}
                        blundersTotal={game.blunderCount}
                        falsePositives={playback.flags.filter(f => !game.blunderIndices.includes(f.moveIndex)).length}
                        blundersMissed={playback.blundersMissed}
                        moveIndex={playback.currentMoveIndex}
                        totalMoves={game.moves.length}
                      />
                    )}
                  </div>

                  {/* Board + button — on desktop, left column */}
                  <div className="col-span-1 md:col-span-4 md:order-1">
                    {/* Top bar with FF slot always allocated */}
                    <div className={`mb-4 flex items-center justify-between border-4 border-black px-4 md:px-6 py-3 gap-2 overflow-hidden ${
                      playback.phase === 'pregame'
                        ? 'bg-white text-black'
                        : currentTurn === 'White' ? 'bg-white text-black' : 'bg-black text-white'
                    }`}>
                      <span className="font-neo font-black text-sm uppercase whitespace-nowrap tracking-wide">
                        {playback.phase === 'pregame' ? 'READY' : `${currentTurn} TO MOVE`}
                      </span>
                      <span className={`font-neo text-sm font-black tracking-widest whitespace-nowrap hidden sm:inline ${playback.isFastForward ? 'opacity-100' : 'invisible'}`}>
                        FF
                      </span>
                      <span className="font-neo text-xs font-bold uppercase tracking-widest opacity-60 whitespace-nowrap">
                        {playback.phase === 'pregame'
                          ? `${game.moves.length} MOVES`
                          : `${Math.max(0, playback.currentMoveIndex + 1)} / ${game.moves.length}`
                        }
                      </span>
                    </div>

                    <GameBoard
                      initialFen={initialFen}
                      moves={game.moves}
                      currentMoveIndex={playback.currentMoveIndex}
                      orientation={orientation}
                      isFastForward={playback.phase === 'playing' && playback.isFastForward}
                      missedBlunderAt={playback.missedBlunderAt}
                    />

                    <BlunderButton
                      onFlag={playback.phase === 'pregame' ? handleStartGame : playback.flagCurrentMove}
                      disabled={playback.phase === 'playing' && (playback.hasFlaggedCurrentMove || playback.currentMoveIndex < 0)}
                      lastFlagResult={playback.lastFlagResult}
                      isPreGame={playback.phase === 'pregame'}
                      moveTimeMs={game && playback.currentMoveIndex >= 0 ? game.pacing[playback.currentMoveIndex] : undefined}
                      moveKey={playback.currentMoveIndex}
                      isWhiteMove={playback.currentMoveIndex >= 0 && playback.currentMoveIndex % 2 === 0}
                      isFastForward={playback.isFastForward}
                    />
                  </div>
                </div>
              )}

              {/* Finished */}
              {playback.phase === 'finished' && (
                <>
                  <div className={`mb-4 flex items-center justify-center border-4 border-black px-6 py-4 ${
                    isCheckmate
                      ? checkmateWinner === 'White' ? 'bg-white text-black' : 'bg-black text-white'
                      : 'bg-gray-100 text-black'
                  }`}>
                    <span className="font-neo font-black text-sm uppercase tracking-widest">
                      {isCheckmate ? `CHECKMATE — ${checkmateWinner} WINS` : 'GAME OVER'}
                    </span>
                  </div>

                  <GameBoard
                    initialFen={initialFen}
                    moves={game.moves}
                    currentMoveIndex={playback.currentMoveIndex}
                    orientation={orientation}
                    isFastForward={playback.isFastForward}
                    missedBlunderAt={playback.missedBlunderAt}
                  />

                  <ResultsScreen
                    gameNumber={game.gameNumber}
                    gameUrl={game.gameUrl}
                    result={submitResult}
                    isSubmitting={isSubmitting}
                    submitError={submitError}
                    onViewLeaderboard={() => setScrollToLeaderboard(true)}
                  />
                  {submitResult && (
                    <BlunderReplay
                      moves={game.moves}
                      initialFen={initialFen}
                      blunderResults={submitResult.blunderResults}
                    />
                  )}
                </>
              )}
            </div>
          )}
        </Article>

        {/* Leaderboard */}
        <div ref={el => { if (el && scrollToLeaderboard) { el.scrollIntoView({ behavior: 'smooth' }); setScrollToLeaderboard(false); } }}>
          <Article title="Daily Leaderboard" subtitle="" styleModifier="pb-6">
            <Leaderboard currentUsername={username} date={today} />
          </Article>
        </div>

        {/* About */}
        <Article title="About Blunder Watch" subtitle="">
        <Subarticle subtitle="Overview">
            <p>Blunder Watch plays back a real chess game from Lichess and challenges you to spot the blunders as they happen. Everyone gets the same game each day and competes on a shared leaderboard.</p>
            <p className="mt-2"><strong>Scoring:</strong> React within 0.5s for 100 points, 1s for 90, 2.5s for 80. Miss a blunder and you score nothing. False positives cost 30 points.</p>
          </Subarticle>
          <Subarticle subtitle="Game Selection">
            <p>Games are sourced from Lichess and pre-analyzed with Stockfish at depth 20. I use Lichess' <a href='https://github.com/lichess-org/lila/blob/cf9e10df24b767b3bc5ee3d88c45437ac722025d/modules/analyse/src/main/Advice.scala#L52'>definition of a blunder</a>. Each game has 3-6 blunders.</p>
          </Subarticle>
        </Article>
      </main>
      <Footer />

      <UsernameModal
        isOpen={showUsernameModal}
        initialUsername={username}
        onSubmit={handleUsernameSubmit}
        onCancel={handleGuestScore}
        cancelLabel="Skip"
      />
    </div>
  );
}
