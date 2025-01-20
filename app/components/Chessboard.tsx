import { useRef, useEffect, useState } from 'react';
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Color } from 'chessground/types';
// import type { LinksFunction } from '@remix-run/node';
// import chessgroundBase from '../styles/chessground.base.css';
// import chessgroundBrown from '../styles/chessground.brown.css';
// import chessgroundCburnett from '../styles/chessground.cburnett.css';

// export const links: LinksFunction = () => [
//   { rel: 'stylesheet', href: chessgroundBase },
//   { rel: 'stylesheet', href: chessgroundBrown },
//   { rel: 'stylesheet', href: chessgroundCburnett }
// ];

// Generate chess squares (a1 through h8)
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const SQUARES = FILES.flatMap(file => RANKS.map(rank => `${file}${rank}`));

interface ChessboardProps {
  initialFen?: string;
  movable?: boolean;
  viewOnly?: boolean;
  playableColor?: Color | 'both';
  orientation?: Color;
  onMove?: (from: string, to: string, fen: string) => void;
  animated?: boolean;
  animationDuration?: number;
  highlightMoves?: boolean;
  draggable?: boolean;
}

export default function Chessboard({ 
  initialFen = 'start',
  movable = true,
  viewOnly = false,
  playableColor = 'both',
  orientation = 'white',
  onMove,
  animated = true,
  animationDuration = 200,
  highlightMoves = true,
  draggable = true
}: ChessboardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [chess] = useState(new Chess(initialFen));
  const cgRef = useRef<Api>();

  const calcMovable = () => {
    if (viewOnly || !movable) return { enabled: false };
    
    const dests = new Map();
    SQUARES.forEach(s => {
      const ms = chess.moves({ square: s, verbose: true });
      if (ms.length) dests.set(s, ms.map(m => m.to));
    });
    
    return {
      free: false,
      dests,
      color: playableColor
    };
  };

  const handleMove = (orig: string, dest: string) => {
    try {
      const move = chess.move({ from: orig, to: dest });
      if (move) {
        const newFen = chess.fen();
        
        // Update the board with new position
        cgRef.current?.set({
          fen: newFen,
          turnColor: chess.turn() === 'w' ? 'white' : 'black',
          movable: calcMovable(),
          lastMove: highlightMoves ? [orig, dest] : undefined
        });

        // Notify parent component if callback provided
        onMove?.(orig, dest, newFen);
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
  };

  useEffect(() => {
    if (!ref.current || cgRef.current) return;

    const config: Config = {
      fen: chess.fen(),
      orientation,
      viewOnly,
      movable: calcMovable(),
      events: {
        move: handleMove
      },
      animation: {
        enabled: animated,
        duration: animationDuration
      },
      highlight: {
        lastMove: highlightMoves,
        check: highlightMoves
      },
      draggable: {
        enabled: draggable && !viewOnly,
        showGhost: true
      }
    };

    cgRef.current = Chessground(ref.current, config);

    return () => {
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = undefined;
      }
    };
  }, [chess, viewOnly, movable, playableColor, orientation, animated, animationDuration, highlightMoves, draggable]);

  // Update board if initialFen changes
  useEffect(() => {
    if (cgRef.current) {
      chess.load(initialFen);
      cgRef.current.set({
        fen: chess.fen(),
        movable: calcMovable()
      });
    }
  }, [initialFen, chess, viewOnly, movable, playableColor]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div 
        ref={ref} 
        className="aspect-square w-full"
      />
    </div>
  );
}