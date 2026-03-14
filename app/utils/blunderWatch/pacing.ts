// Server-side pacing schedule computation.
// Returns an array where pacing[i] = ms to display move i before advancing.
// Blunder indices are also sent to the client for live feedback, but the pacing
// array is what drives playback timing so blunder proximity stays opaque.

const OPENING_MS = 1000;    // moves 0–17 (first 9 full moves)
const MIDGAME_MS = 2000;
const FAST_MS = 400;
const QUIET_STREAK_THRESHOLD = 10; // consecutive non-blunder moves before fast-forward kicks in

// Pseudo-random 2–5 based on blunder index — deterministic per game, not leaked to client
function resumeBeforeBlunder(blunderIndex: number): number {
  return 2 + (blunderIndex * 31 + 7) % 4;
}

export function computePacing(moveCount: number, blunderIndices: number[]): number[] {
  const blunderSet = new Set(blunderIndices);
  const pacing: number[] = [];

  let consecutiveNonBlunder = 0;
  let inFastForward = false;

  for (let i = 0; i < moveCount; i++) {
    const isBlunder = blunderSet.has(i);

    // Find the next blunder after this move
    const nextBlunder = blunderIndices.find(b => b > i);
    const distToNextBlunder = nextBlunder !== undefined ? nextBlunder - i : Infinity;
    const runway = nextBlunder !== undefined ? resumeBeforeBlunder(nextBlunder) : 2;

    if (isBlunder) {
      consecutiveNonBlunder = 0;
      inFastForward = false;
    } else {
      consecutiveNonBlunder++;

      // Exit fast-forward when approaching the next blunder
      if (distToNextBlunder <= runway) {
        inFastForward = false;
      }

      // Enter fast-forward after a long quiet streak (but not if a blunder is imminent)
      if (consecutiveNonBlunder >= QUIET_STREAK_THRESHOLD && distToNextBlunder > runway) {
        inFastForward = true;
      }
    }

    const isOpening = i < 18; // plies 0–17
    const isWhiteMove = i % 2 === 0; // even ply = White's move
    let ms: number;

    if (inFastForward) {
      ms = FAST_MS;
    } else if (isOpening) {
      ms = OPENING_MS;
    } else {
      ms = MIDGAME_MS;
    }

    // White moves display 50% longer so players have more time to react
    if (!inFastForward && isWhiteMove) {
      ms = Math.round(ms * 1.5);
    }

    pacing.push(ms);
  }

  return pacing;
}
