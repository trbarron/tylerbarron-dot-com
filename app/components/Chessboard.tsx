import { useRef, useEffect, useState, useCallback } from 'react';
import { Chessground } from 'chessground';
import { Chess, type Square } from 'chess.js';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Color, Key, Piece } from 'chessground/types';
import type { DrawShape } from 'chessground/draw';

export interface ChessboardProps {
  initialFen?: string;
  /**
   * Change this to put the pieces back on `initialFen` even when it hasn't
   * changed, e.g. a puzzle's second try. Cheaper than a new `key`, which
   * rebuilds the board and flashes it empty first.
   */
  resetKey?: string | number;
  movable?: boolean;
  viewOnly?: boolean;
  allowDrawing?: boolean;
  playableColor?: Color | 'both';
  orientation?: Color;
  onMove?: (from: string, to: string, fen: string) => void;
  animated?: boolean;
  animationDuration?: number;
  highlightMoves?: boolean;
  lastMove?: [string, string];
  autoShapes?: DrawShape[];
  draggable?: boolean | {
    enabled?: boolean;
    showGhost?: boolean;
  };
  selectable?: {
    enabled?: boolean;
  };
  events?: {
    select?: (key: string) => void;
    move?: (orig: string, dest: string, capturedPiece?: unknown) => void;
    change?: () => void;
  };
  drawable?: {
    enabled?: boolean;
    visible?: boolean;
    defaultSnapToValidMove?: boolean;
    eraseOnClick?: boolean;
    onChange?: (shapes: DrawShape[]) => void;
    shapes?: DrawShape[];
    autoShapes?: DrawShape[];
  };
  ref?: React.RefObject<HTMLDivElement | Api>;
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const normalizeFen = (fen: string) => fen === 'start' ? STARTING_FEN : fen;

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
  lastMove,
  autoShapes = [],
  draggable = true,
  selectable = {},
  events = {},
  drawable = {},
  resetKey,
  ref: externalRef
}: ChessboardProps) {
  const internalRef = useRef<HTMLDivElement>(null);
  const [chess] = useState(new Chess(normalizeFen(initialFen)));
  const cgRef = useRef<Api | undefined>(undefined);
  const [isClient, setIsClient] = useState(false);

  // Use the external ref if provided, otherwise use internal
  const ref = (externalRef as React.RefObject<HTMLDivElement>) || internalRef;

  // Ensure component only initializes on client
  useEffect(() => {
    setIsClient(true);
  }, []);

  const calcMovable = useCallback(() => {
    if (viewOnly || !movable) return { free: false, dests: new Map() };

    const dests = new Map();
    SQUARES.forEach(s => {
      const ms = chess.moves({ square: s as Square, verbose: true });
      if (ms.length) dests.set(s, ms.map(m => m.to));
    });
    
    return {
      free: false,
      dests,
      color: playableColor
    };
  }, [chess, movable, playableColor, viewOnly]);

  const handleMove = useCallback((orig: string, dest: string) => {
    try {
      // Auto-queen: chess.js rejects a promotion without a piece, and ignores
      // the field on every other move.
      const move = chess.move({ from: orig, to: dest, promotion: 'q' });
      if (move) {
        const newFen = chess.fen();
        
        cgRef.current?.set({
          fen: newFen,
          turnColor: chess.turn() === 'w' ? 'white' : 'black',
          movable: calcMovable(),
          lastMove: highlightMoves ? [orig as Key, dest as Key] : undefined
        });

        onMove?.(orig, dest, newFen);
      }
    } catch (error) {
      console.error('Invalid move:', error);
    }
  }, [calcMovable, chess, highlightMoves, onMove]);

  useEffect(() => {
    if (!isClient || !ref.current || cgRef.current) return;

    const config: Config = {
      fen: chess.fen(),
      // Without this chessground assumes white to move, so a black-to-move
      // position can't be played.
      turnColor: chess.turn() === 'w' ? 'white' : 'black',
      orientation,
      viewOnly,
      lastMove: lastMove as Key[],
      movable: calcMovable(),
      events: {
        move: handleMove as (orig: Key, dest: Key, capturedPiece?: Piece) => void,
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
      drawable: {
        enabled: allowDrawing,
        autoShapes: autoShapes,
        ...drawable
      },
      selectable: selectable
    };

    cgRef.current = Chessground(ref.current, config);

    // If external ref provided, expose the chessground instance
    if (externalRef && cgRef.current) {
      (externalRef as React.MutableRefObject<Api | null>).current = cgRef.current;
    }

    return () => {
      if (cgRef.current) {
        cgRef.current.destroy();
        cgRef.current = undefined;
      }
    };
  }, [isClient, chess, viewOnly, movable, allowDrawing, playableColor, orientation, 
      animated, animationDuration, highlightMoves, lastMove, autoShapes, draggable, events, 
      drawable, selectable, calcMovable, handleMove, externalRef, ref]);

  // Update board if initialFen, lastMove or resetKey changes
  useEffect(() => {
    if (cgRef.current) {
      chess.load(normalizeFen(initialFen));
      cgRef.current.set({
        fen: chess.fen(),
        turnColor: chess.turn() === 'w' ? 'white' : 'black',
        movable: calcMovable(),
        lastMove: lastMove as Key[],
      });
    }
  }, [initialFen, resetKey, chess, viewOnly, movable, playableColor, lastMove, calcMovable]);

  // Update arrow shapes independently so hover doesn't reload the FEN
  useEffect(() => {
    cgRef.current?.set({ drawable: { autoShapes } });
  }, [autoShapes]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        ref={ref}
        className={`aspect-square w-full ${!isClient ? 'min-h-[400px]' : ''}`}
      />
    </div>
  );
}
