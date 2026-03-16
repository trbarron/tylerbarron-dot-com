// Server-side pacing schedule computation.
// Returns an array where pacing[i] = ms to display move i before advancing.
// After the last blunder, the client switches to fast-forward automatically,
// so this array only needs to cover normal-speed pacing.

const OPENING_MS = 1000;    // moves 0–17 (first 9 full moves)
const MIDGAME_MS = 2000;

export function computePacing(moveCount: number): number[] {
  const pacing: number[] = [];

  for (let i = 0; i < moveCount; i++) {
    const isOpening = i < 18; // plies 0–17
    const isWhiteMove = i % 2 === 0; // even ply = White's move
    let ms = isOpening ? OPENING_MS : MIDGAME_MS;

    // White moves display longer so players have more time to react.
    // White: +500ms on top of 1.5x scaling.
    // Black: -250ms.
    if (isWhiteMove) {
      ms = Math.round(ms * 1.5) + 500;
    } else {
      ms = ms - 250;
    }

    pacing.push(ms);
  }

  return pacing;
}
