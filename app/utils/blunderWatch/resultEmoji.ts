// Wordle-style result emoji builder for Blunder Watch

import type { BlunderResult } from './types';

// One emoji per blunder (ordered by position)
// 🟩 Great  🟨 Good  🟧 Okay  ⬜ Missed
export function buildResultEmoji(blunderResults: BlunderResult[]): string {
  const blunderEmojis = blunderResults.map(r => {
    switch (r.outcome) {
      case 'caught_fast':   return '🟩';
      case 'caught_medium': return '🟨';
      case 'caught_slow':   return '🟧';
      case 'missed':        return '⬜';
    }
  });

  return blunderEmojis.join('');
}

export function buildShareText(
  gameNumber: number,
  totalScore: number,
  blunderResults: BlunderResult[],
  falsePositives: number,
  blundersCaught: number,
): string {
  const emoji = buildResultEmoji(blunderResults);
  const blunderCount = blunderResults.length;
  const lines = [
    `Blunder Watch #${gameNumber} — ${totalScore} pts`,
    emoji,
    `${blunderCount} blunders | ${blundersCaught} caught | ${falsePositives} false positive${falsePositives !== 1 ? 's' : ''}`,
    'tylerbarron.com/blunder-watch',
  ];
  return lines.join('\n');
}
