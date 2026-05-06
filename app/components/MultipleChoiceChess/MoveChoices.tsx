import type { CandidateMove } from "~/utils/multipleChoiceChess/moveParser";

function renderSan(san: string) {
  const idx = san.indexOf('x');
  if (idx === -1) return san;
  return (
    <>
      {san.slice(0, idx)}
      <span className="text-base align-middle">x</span>
      {san.slice(idx + 1)}
    </>
  );
}

interface MoveChoicesProps {
  moves: CandidateMove[];
  pickedUci: string | null; // null = not yet picked
  onPick: (move: CandidateMove) => void;
  onHover?: (uci: string | null) => void;
  disabled: boolean;
}

export default function MoveChoices({
  moves,
  pickedUci,
  onPick,
  onHover,
  disabled,
}: MoveChoicesProps) {
  const hasPicked = pickedUci !== null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {moves.map((move) => {
        const isPicked = move.uci === pickedUci;

        return (
          <button
            key={move.uci}
            onClick={() => !disabled && !hasPicked && onPick(move)}
            onMouseEnter={() => !hasPicked && onHover?.(move.uci)}
            onMouseLeave={() => !hasPicked && onHover?.(null)}
            onTouchStart={() => !hasPicked && onHover?.(move.uci)}
            onTouchEnd={() => !hasPicked && onHover?.(null)}
            onTouchCancel={() => !hasPicked && onHover?.(null)}
            disabled={disabled || hasPicked}
            className={[
              'touch-manipulation border-4 border-black px-4 py-5 font-neo font-extrabold uppercase tracking-wide transition-colors',
              isPicked
                ? 'bg-black text-white'
                : hasPicked
                  ? 'bg-white text-gray-400 border-gray-300'
                  : 'bg-white text-black hover:bg-black hover:text-white active:bg-black active:text-white',
            ].join(' ')}
          >
            <span className="text-2xl leading-none">{renderSan(move.san)}</span>
          </button>
        );
      })}
    </div>
  );
}
