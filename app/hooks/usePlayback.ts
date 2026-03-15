// Drives Blunder Watch move playback timing.
// Manages the state machine: pregame → playing → finished.
// Uses the pre-computed pacing[] array from the game data for timing,
// so blunder proximity logic stays server-side.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { BlunderWatchGame, Flag, GamePhase } from '~/utils/blunderWatch/types';

const INITIAL_PAUSE_MS = 1500; // How long to show the starting position before move 1
const FAST_FORWARD_MS = 400;   // Speed when fast-forwarding

export interface PlaybackState {
  phase: GamePhase;
  currentMoveIndex: number;   // -1 = pre-first-move, 0+ = after that move was played
  isFastForward: boolean;
  hasFlaggedCurrentMove: boolean;
  missedBlunderAt: number;     // timestamp of last missed blunder
  blundersMissed: number;      // count of blunders missed
  flags: Flag[];
  liveScore: number;
  lastFlagResult: 'correct' | 'false_positive' | null;
}

export interface PlaybackControls {
  startGame: () => void;
  flagCurrentMove: () => void;
}

export function usePlayback(game: BlunderWatchGame | null): PlaybackState & PlaybackControls {
  const [phase, setPhase] = useState<GamePhase>('pregame');
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [hasFlaggedCurrentMove, setHasFlaggedCurrentMove] = useState(false);
  const [missedBlunderAt, setMissedBlunderAt] = useState(0);
  const [blundersMissed, setBlundersMissed] = useState(0);
  const [flags, setFlags] = useState<Flag[]>([]);
  const [liveScore, setLiveScore] = useState(0);
  const [lastFlagResult, setLastFlagResult] = useState<'correct' | 'false_positive' | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveDisplayedAtRef = useRef<number>(0);
  const hasFlaggedRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Advance the game one step
  const advance = useCallback(() => {
    setCurrentMoveIndex(prev => prev + 1);
  }, []);

  const lastBlunderIndex = useMemo(() => {
    if (!game || game.blunderIndices.length === 0) return -1;
    return Math.max(...game.blunderIndices);
  }, [game]);

  const isPostBlunder = game !== null && currentMoveIndex > lastBlunderIndex;

  // Drive the timer whenever currentMoveIndex or phase changes
  useEffect(() => {
    if (phase !== 'playing' || !game) return;
    clearTimer();

    moveDisplayedAtRef.current = Date.now();
    setHasFlaggedCurrentMove(false);
    hasFlaggedRef.current = false;
    setLastFlagResult(null);

    const isLastMove = currentMoveIndex === game.moves.length - 1;
    const delay =
      currentMoveIndex === -1
        ? INITIAL_PAUSE_MS
        : isPostBlunder
          ? FAST_FORWARD_MS
          : (game.pacing[currentMoveIndex] ?? 2000);

    const onFinish = () => {
      // If this was a blunder move and it wasn't flagged, mark it as missed
      if (currentMoveIndex >= 0 && game.blunderIndices.includes(currentMoveIndex) && !hasFlaggedRef.current) {
        setMissedBlunderAt(Date.now());
        setBlundersMissed(prev => prev + 1);
      }

      if (isLastMove) {
        setPhase('finished');
      } else {
        advance();
      }
    };

    timerRef.current = setTimeout(onFinish, delay);

    return clearTimer;
  }, [currentMoveIndex, phase, game, advance, isPostBlunder]);

  // Derived fast-forward state
  const isFastForward =
    game !== null &&
    currentMoveIndex >= 0 &&
    ((game.pacing[currentMoveIndex] ?? 2000) <= 400 || isPostBlunder);

  const startGame = useCallback(() => {
    setPhase('playing');
    setCurrentMoveIndex(-1);
    setFlags([]);
    setLiveScore(0);
    setHasFlaggedCurrentMove(false);
    hasFlaggedRef.current = false;
    setMissedBlunderAt(0);
    setBlundersMissed(0);
    setLastFlagResult(null);
  }, []);

  const flagCurrentMove = useCallback(() => {
    if (phase !== 'playing' || hasFlaggedCurrentMove || currentMoveIndex < 0 || !game) return;

    // Silently ignore presses during Black's move (odd ply index)
    if (currentMoveIndex % 2 !== 0) return;

    // Silently ignore presses during fast-forward (cutscene)
    const isFF = (game.pacing[currentMoveIndex] ?? 2000) <= 400 || currentMoveIndex > lastBlunderIndex;
    if (isFF) return;

    const reactionTimeMs = Math.max(0, Date.now() - moveDisplayedAtRef.current);
    const isBlunder = game.blunderIndices.includes(currentMoveIndex);

    const newFlag: Flag = { moveIndex: currentMoveIndex, reactionTimeMs };
    setFlags(prev => [...prev, newFlag]);
    setHasFlaggedCurrentMove(true);
    hasFlaggedRef.current = true;

    if (isBlunder) {
      const points = reactionTimeMs <= 500 ? 100 : reactionTimeMs <= 1000 ? 90 : 80;
      setLiveScore(prev => prev + points);
      setLastFlagResult('correct');
    } else {
      setLiveScore(prev => prev - 30);
      setLastFlagResult('false_positive');
    }
  }, [phase, hasFlaggedCurrentMove, currentMoveIndex, game, lastBlunderIndex]);

  return {
    phase,
    currentMoveIndex,
    isFastForward,
    hasFlaggedCurrentMove,
    missedBlunderAt,
    blundersMissed,
    flags,
    liveScore,
    lastFlagResult,
    startGame,
    flagCurrentMove,
  };
}
