// Scrollable replay of each blunder shown on the results screen.
// Displays a static board thumbnail, eval swing, and the player's outcome.

import { Suspense, lazy } from 'react';
import { Chess } from 'chess.js';
import type { Key } from 'chessground/types';
import type { BlunderResult } from '~/utils/blunderWatch/types';

const Chessboard = lazy(() => import('~/components/Chessboard'));

interface BlunderReplayProps {
  moves: string[];
  initialFen: string;
  blunderResults: BlunderResult[];
}

function getBlunderMove(initialFen: string, moves: string[], moveIndex: number): { fen: string; lastMove: [string, string] | undefined } {
  const chess = new Chess(initialFen);
  let lastMove: [string, string] | undefined;
  for (let i = 0; i <= moveIndex && i < moves.length; i++) {
    const move = chess.move(moves[i]);
    if (i === moveIndex && move) {
      lastMove = [move.from, move.to];
    }
  }
  return { fen: chess.fen(), lastMove };
}

function formatEval(cp: number): string {
  if (Math.abs(cp) >= 10_000) return cp > 0 ? '+M' : '-M';
  const pawns = cp / 100;
  return (pawns >= 0 ? '+' : '') + pawns.toFixed(2);
}

function outcomeLabel(result: BlunderResult): { label: string; className: string } {
  switch (result.outcome) {
    case 'caught_fast':   return { label: `✓ Great (+${result.points}pts)`,  className: 'bg-black text-white border-black' };
    case 'caught_medium': return { label: `✓ Good (+${result.points}pts)`,   className: 'bg-white text-black border-black' };
    case 'caught_slow':   return { label: `✓ Okay (+${result.points}pts)`,   className: 'bg-white text-black border-black opacity-70' };
    case 'missed':        return { label: '✗ Missed',                         className: 'bg-gray-100 text-black border-black opacity-60' };
  }
}

export function BlunderReplay({ moves, initialFen, blunderResults }: BlunderReplayProps) {
  if (blunderResults.length === 0) return null;

  return (
    <div className="bg-white border-4 border-black mt-4">
      <div className="border-b-2 border-black px-4 py-2">
        <h3 className="font-neo font-bold uppercase text-black text-sm">Blunder Replay</h3>
      </div>
      <div className="divide-y-2 divide-black">
        {blunderResults.map((result, i) => {
          const { fen, lastMove } = getBlunderMove(initialFen, moves, result.moveIndex);
          const autoShapes = lastMove ? [{
            orig: lastMove[0] as Key,
            dest: lastMove[1] as Key,
            brush: 'red', // red arrow for blunders
          }] : [];
          const fullMoveNumber = Math.floor(result.moveIndex / 2) + 1;
          const sideLabel = result.moveIndex % 2 === 0 ? 'White' : 'Black';
          const evalSwing = result.evalAfter - result.evalBefore;
          const orientation = result.moveIndex % 2 === 0 ? 'white' : ('black' as 'white' | 'black');
          const { label, className } = outcomeLabel(result);

          return (
            <div key={i} className="p-4 grid grid-cols-3 gap-4 items-start">
              {/* Mini board */}
              <div className="col-span-1">
                <Suspense fallback={<div className="aspect-square bg-gray-100 w-full" />}>
                  <Chessboard
                    key={fen}
                    initialFen={fen}
                    lastMove={lastMove}
                    autoShapes={autoShapes}
                    movable={false}
                    viewOnly
                    allowDrawing={false}
                    orientation={orientation}
                    animated={false}
                  />
                </Suspense>
              </div>

              {/* Info */}
              <div className="col-span-2">
                <p className="font-neo font-bold text-black text-sm mb-1">
                  Move {fullMoveNumber} — {sideLabel} blundered
                </p>
                <p className="font-mono text-xs text-gray-700 mb-2">
                  {formatEval(result.evalBefore)} → {formatEval(result.evalAfter)}&nbsp;
                  <span className="opacity-60">
                    ({evalSwing > 0 ? '+' : ''}{(evalSwing / 100).toFixed(2)})
                  </span>
                </p>
                <div className={`inline-block border-2 px-2 py-1 font-neo text-xs font-bold ${className}`}>
                  {label}
                </div>
                {result.reactionTimeMs !== undefined && (
                  <p className="font-neo text-xs text-black opacity-40 mt-1">
                    Reaction: {(result.reactionTimeMs / 1000).toFixed(2)}s
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
