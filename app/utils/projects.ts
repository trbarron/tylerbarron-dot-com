/**
 * Every project the homepage lists, in display order within each category.
 * The sitemap reads its project paths from here too.
 *
 * A blog post with `type: project` frontmatter also needs an entry (url
 * `/blog/<slug>`, same title); a unit test checks that.
 */

export type ProjectCategory = 'chess' | 'games' | 'puzzles' | 'gadgets';

/** `short` is the homepage index's label. */
export const PROJECT_CATEGORIES: { id: ProjectCategory; label: string; short: string }[] = [
  { id: 'chess', label: 'Chess', short: 'Chess' },
  { id: 'games', label: 'Games', short: 'Games' },
  { id: 'puzzles', label: 'Puzzles & Data', short: 'Puzzles' },
  { id: 'gadgets', label: 'Gadgets & Art', short: 'Gadgets' },
];

export interface Project {
  title: string;
  description: string;
  /** A site path (`/chesser-guesser`) or an absolute URL for an external project. */
  url: string;
  category: ProjectCategory;
}

export const PROJECTS: Project[] = [
  // Chess
  {
    title: 'Chesser Guesser',
    description: 'Can you tell who is winning the chess game?',
    url: '/chesser-guesser',
    category: 'chess',
  },
  {
    title: 'Blunder Watch',
    description: 'Spot the blunders as a chess game plays out',
    url: '/blunder-watch',
    category: 'chess',
  },
  {
    title: 'Collaborative Checkmate',
    description: 'Play chess with your friends',
    url: '/collaborative-checkmate',
    category: 'chess',
  },
  {
    title: 'Multiple Choice Chess',
    description: 'Pick the best move from four engine-generated options',
    url: '/multiple-choice-chess',
    category: 'chess',
  },
  {
    title: 'Marginal Maia Mentor',
    description: 'Flashcards from the moves a slightly stronger you would have played',
    url: '/marginal-maia-mentor',
    category: 'chess',
  },

  // Games
  {
    title: 'Runescape Rascals',
    description: 'Four AI agents playing a RuneScape-style world together',
    url: '/runescape-rascals',
    category: 'games',
  },
  {
    title: 'Camel Up Cup',
    description: '"Bring your own board game playing bot" competition',
    url: '/camel-up-cup',
    category: 'games',
  },
  { title: 'Planomancer', description: 'A card battler', url: '/blog/planomancer', category: 'games' },
  {
    title: 'Stardew Valley Mod: LLM Dialog',
    description: 'Replacing character dialogue with AI-generated responses',
    url: '/blog/stardewLLMDialog',
    category: 'games',
  },
  {
    title: 'Spheroid Zero',
    description: 'A Godot game, a game jam submission',
    url: 'https://trbarron.itch.io/spheroid-zero',
    category: 'games',
  },
  {
    title: 'Super Smash Bros. Melee Mods',
    description: 'Collection of hardware and software mods',
    url: '/SSBM',
    category: 'games',
  },

  // Puzzles & data
  {
    title: 'National Pizza Ratings',
    description: "Using Domino's to find the best pizza",
    url: '/pizza-rating',
    category: 'puzzles',
  },
  {
    title: "FiveThirtyEight's The Riddler",
    description: 'Math puzzles and problems',
    url: '/the-riddler',
    category: 'puzzles',
  },
  { title: 'Set', description: 'Using computer vision to play a board game', url: '/set', category: 'puzzles' },

  // Gadgets & art
  {
    title: 'Cat Work Tracker',
    description: "Measuring the cat's time in the office",
    url: '/cat-tracker',
    category: 'gadgets',
  },
  {
    title: 'Bouldering Tracker',
    description: 'Using computer vision to track climbing style',
    url: '/bouldering-tracker',
    category: 'gadgets',
  },
  {
    title: 'Vestaboard Display Controller',
    description: 'Showing information in a split-flap display',
    url: '/blog/vestaboardController',
    category: 'gadgets',
  },
  {
    title: 'Smart Cycling Fan Controller',
    description: 'Tying heart rate to fan speed',
    url: '/blog/smartCyclingFanController',
    category: 'gadgets',
  },
  {
    title: 'YouTube Speed Sense',
    description: 'Adjust video playback speed based on categories',
    url: 'https://chromewebstore.google.com/detail/youtube-speed-sense/efgmcojhefjjdpdnnmclekblhpaiaedo',
    category: 'gadgets',
  },
  {
    title: 'Generative Art',
    description: 'Dive into plotters and generative art',
    url: '/generative-art',
    category: 'gadgets',
  },
];

/** The homepage's highlight cards, in order (each is still listed under its category too). */
const FEATURED_URLS = ['/cat-tracker', '/runescape-rascals', '/camel-up-cup', '/marginal-maia-mentor'];

export const FEATURED_PROJECTS: Project[] = FEATURED_URLS.map((url) => {
  const project = PROJECTS.find((p) => p.url === url);
  if (!project) throw new Error(`Featured project ${url} is not in PROJECTS`);
  return project;
});

export function isExternal(url: string): boolean {
  return /^https?:\/\//.test(url);
}

/** Project pages on this site (not blog posts, not external links), for the sitemap. */
export const PROJECT_PATHS: string[] = PROJECTS.map((p) => p.url).filter(
  (url) => !isExternal(url) && !url.startsWith('/blog/'),
);
