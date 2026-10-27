import type { Bot } from './types';

/** Keep the current task and target, while leaving routine bookkeeping in the details. */
export function activitySummary(bot: Pick<Bot, 'action' | 'routine'>): string {
  const step = bot.routine?.steps[bot.routine.step];
  const text = (step || bot.action.split(/:\s*step\s+\d+\/\d+,\s*/i).at(-1) || 'Deciding')
    .replace(/_/g, ' ')
    .replace(/\s*\((?:loop\s+\d+|\d+\s*(?:min|sec))\)/gi, '')
    .trim();
  const fight = text.match(/^fight\s*\(([^)]+)\)\s*until\s+(.+)$/i);
  if (fight) return `Training ${fight[2]} · ${fight[1]}`;
  const work = text.match(/^(mine|fish|chop|smelt|smith|cook)\s*\(([^)]+)\)(?:\s+until\s+(.+))?$/i);
  if (work) {
    const verbs: Record<string, string> = {
      mine: 'Mining',
      fish: 'Fishing',
      chop: 'Chopping',
      smelt: 'Smelting',
      smith: 'Smithing',
      cook: 'Cooking',
    };
    return `${verbs[work[1].toLowerCase()]} ${work[2]}${work[3] ? ` · ${work[3]}` : ''}`;
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}
