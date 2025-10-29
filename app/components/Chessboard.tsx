import { useRef, useEffect, useState } from 'react';
import { Chessground } from 'chessground';
import { Chess } from 'chess.js';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Color } from 'chessground/types';

interface ChessboardProps {
  initialFen?: string;
  movable?: boolean;
  viewOnly?: boolean;
  allowDrawing?: boolean;
  playableColor?: Color | 'both';
  orientation?: Color;
  onMove?: (from: string, to: string, fen: string) => void;
  animated?: boolean;
  animationDuration?: number;
  highlightMoves?: boolean;
  draggable?: boolean | {
    enabled?: boolean;
    showGhost?: boolean;
  };
  selectable?: {
    enabled?: boolean;
  };
  events?: {
    select?: (key: string) => void;
    move?: (orig: string, dest: string, capturedPiece?: any) => void;
    change?: () => void;
  };
  drawable?: {
    enabled?: boolean;
    visible?: boolean;
    defaultSnapToValidMove?: boolean;
    eraseOnClick?: boolean;
    onChange?: (shapes: any[]) => void;
    shapes?: any[];
    autoShapes?: any[];
  };
  ref?: React.RefObject<any>;
}

// Generate chess squares (a1 through h8)
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];
const SQUARES = FILES.flatMap(file => RANKS.map(rank => `${file}${rank}`));

export default function Chessboard({ 
  initialFen = 'start',
  movable = true,
  viewOnly = false,
  allowDrawing = true,
  playableColor = 'both',
  orientation = 'white',
  onMove,
  animated = true,
  animationDuration = 200,
  highlightMoves = true,
  draggable = true,
  selectable = {},
  events = {},
  drawable = {},
  ref: externalRef
}: ChessboardProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const [chess] = useState(new Chess(initialFen));
  const cgRef = useRef<Api>();
  const [isClient, setIsClient] = useState(false);

  // Use the external ref if provided, otherwise use internal
  const ref = externalRef || internalRef;

  // Ensure component only initializes on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  const calcMovable = () => {
    if (viewOnly || !movable) return { enabled: false, free: false };
    
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
        
        cgRef.current?.set({
          fen: newFen,
          turnColor: chess.turn() === 'w' ? 'white' : 'black',
          movable: calcMovable(),
          lastMove: highlightMoves ? [orig, dest] : undefined
        });

        onMove?.(orig, dest, newFen);
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
  };

  useEffect(() => {
    if (!isClient || !ref.current || cgRef.current) return;

    const config: Config = {
      fen: chess.fen(),
      orientation,
      viewOnly,
      movable: typeof movable === 'boolean' ? { 
        enabled: movable,
        free: false 
      } : movable,
      events: {
        move: handleMove,
        ...events
      },
      animation: {
        enabled: animated,
        duration: animationDuration
      },
      highlight: {
        lastMove: highlightMoves,
        check: highlightMoves
      },
      draggable: typeof draggable === 'boolean' ? {
        enabled: draggable && !viewOnly && !!movable,
        showGhost: true
      } : {
        ...draggable,
        enabled: draggable.enabled && !viewOnly && !!movable
      },
      drawable: drawable || {
        enabled: allowDrawing,
      },
      selectable: selectable
    };

    cgRef.current = Chessground(ref.current, config);

    // If external ref provided, expose the chessground instance
    if (externalRef) {
      externalRef.current = cgRef.current;
    }

    return () => {
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = undefined;
      }
    };
  }, [isClient, chess, viewOnly, movable, allowDrawing, playableColor, orientation, 
      animated, animationDuration, highlightMoves, draggable, events, 
      drawable, selectable]);

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
        style={{ minHeight: isClient ? 'auto' : '400px' }}
      />
    </div>
  );
}