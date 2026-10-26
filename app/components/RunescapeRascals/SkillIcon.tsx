// The game's own stat icons, cut from its staticons sprite sheets into one 6 x 4 grid of 25px cells
// (row-major, in the order below). Tailwind only sees whole class names, so each cell's offset is spelled out.
const OFFSET: Record<string, string> = {
  attack: 'bg-[position:-0px_-0px]',
  strength: 'bg-[position:-25px_-0px]',
  defence: 'bg-[position:-50px_-0px]',
  ranged: 'bg-[position:-75px_-0px]',
  prayer: 'bg-[position:-100px_-0px]',
  magic: 'bg-[position:-125px_-0px]',
  hitpoints: 'bg-[position:-0px_-25px]',
  agility: 'bg-[position:-25px_-25px]',
  herblore: 'bg-[position:-50px_-25px]',
  thieving: 'bg-[position:-75px_-25px]',
  crafting: 'bg-[position:-100px_-25px]',
  fletching: 'bg-[position:-125px_-25px]',
  mining: 'bg-[position:-0px_-50px]',
  smithing: 'bg-[position:-25px_-50px]',
  fishing: 'bg-[position:-50px_-50px]',
  cooking: 'bg-[position:-75px_-50px]',
  firemaking: 'bg-[position:-100px_-50px]',
  woodcutting: 'bg-[position:-125px_-50px]',
  runecraft: 'bg-[position:-0px_-75px]',
};

/** Decorative: the skill's name always sits beside it. Renders nothing for a skill without an icon. */
export function SkillIcon({ skill }: { skill: string }) {
  const offset = OFFSET[skill.toLowerCase()];
  if (!offset) return null;
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-[25px] shrink-0 bg-[url(/images/runescape-rascals/skill-icons.png)] bg-no-repeat [image-rendering:pixelated] ${offset}`}
    />
  );
}
