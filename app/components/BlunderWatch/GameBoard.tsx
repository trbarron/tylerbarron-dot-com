// Chessground board for Blunder Watch playback.
// Manages its own Chessground instance directly so it can drive animated move playback
// via cgRef.current.set({ fen, lastMove }) instead of the key-remount pattern.

import { useRef, useEffect, useState } from 'react';
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import type { Api } from 'chessground/api';
import type { Key } from 'chessground/types';

interface GameBoardProps {
  initialFen: string;
  moves: string[];          // full SAN move list
  currentMoveIndex: number; // -1 = initial position, 0+ = after that move played
  orientation: 'white' | 'black';
  isFastForward: boolean;
}

export function GameBoard({ initialFen, moves, currentMoveIndex, orientation, isFastForward }: GameBoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cgRef = useRef<Api | undefined>(undefined);
  const chessRef = useRef(new Chess(initialFen));
  const prevIndexRef = useRef(-1);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  // Initialise Chessground once
  useEffect(() => {
    if (!isClient || !containerRef.current || cgRef.current) return;

    cgRef.current = Chessground(containerRef.current, {
      fen: chessRef.current.fen(),
      orientation,
      viewOnly: true,
      movable: { free: false, dests: new Map() },
      animation: { enabled: true, duration: 200 },
      highlight: { lastMove: true, check: false },
      draggable: { enabled: false },
      drawable: { enabled: false },
    });

    prevIndexRef.current = -1;

    return () => {
      cgRef.current?.destroy();
      cgRef.current = undefined;
    };
  }, [isClient, orientation]);

  // Advance the board whenever currentMoveIndex changes
  useEffect(() => {
    if (!cgRef.current) return;

    const prev = prevIndexRef.current;

    if (currentMoveIndex === -1) {
      // Reset to starting position
      chessRef.current.load(initialFen);
      cgRef.current.set({ fen: chessRef.current.fen(), lastMove: undefined });
      prevIndexRef.current = -1;
      return;
    }

    if (currentMoveIndex > prev) {
      // Play moves forward (usually just one step)
      for (let i = prev + 1; i <= currentMoveIndex; i++) {
        const san = moves[i];
        if (!san) break;
        const moveResult = chessRef.current.move(san);
        if (moveResult) {
          cgRef.current.set({
            fen: chessRef.current.fen(),
            lastMove: [moveResult.from as Key, moveResult.to as Key],
            turnColor: chessRef.current.turn() === 'w' ? 'white' : 'black',
          });
        }
      }
    } else if (currentMoveIndex < prev) {
      // Rewind (shouldn't happen in normal play, but handle for safety)
      chessRef.current.load(initialFen);
      for (let i = 0; i <= currentMoveIndex; i++) {
        chessRef.current.move(moves[i]);
      }
      cgRef.current.set({ fen: chessRef.current.fen() });
    }

    prevIndexRef.current = currentMoveIndex;
  }, [currentMoveIndex, moves, initialFen]);

  return (
    <div className="w-full">
      {/* Fast-forward indicator */}
      <div className={`h-1 mb-2 transition-colors duration-300 ${isFastForward ? 'bg-yellow-400' : 'bg-transparent'}`} />

      {isFastForward && (
        <div className="mb-2 text-center">
          <span className="font-neo text-xs uppercase tracking-widest text-yellow-600 font-bold">
            Fast-forward
          </span>
        </div>
      )}

      {/* Board */}
      <div className={`w-full max-w-2xl mx-auto border-4 transition-colors duration-300 ${isFastForward ? 'border-yellow-400' : 'border-black'}`}>
        <div
          ref={containerRef}
          className={`aspect-square w-full ${!isClient ? 'min-h-[300px] bg-gray-100' : ''}`}
        />
      </div>
    </div>
  );
}
