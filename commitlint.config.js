// The one place that says what a commit scope is. `type(scope): subject` — the scope names the
// project the change is for, so history, release notes and `git log --grep` agree. A commit
// that touches nothing project-specific (a dependency bump, tooling) leaves the scope off.
// A scope that is not listed here fails the commit-msg hook; add the project below first.
//
// The scope is the project's name in kebab-case, shortened only where the short form was
// already the habit. Do not invent a second spelling (rr, cc, runescape-rascals, chesserGuesser).

/** Project scopes: scope -> what it covers. */
export const PROJECTS = {
  rascals: 'Runescape Rascals (/runescape-rascals), the agent party dashboard',
  maia: 'Marginal Maia Mentor (/marginal-maia-mentor), Maia Drills',
  pizza: 'Pizza Rating and the pizza map (/pizza-rating)',
  'chesser-guesser': 'Chesser Guesser (/chesser-guesser)',
  'collaborative-checkmate': 'Collaborative Checkmate (/collaborative-checkmate)',
  'blunder-watch': 'Blunder Watch (/blunder-watch)',
  'multiple-choice-chess': 'Multiple Choice Chess (/multiple-choice-chess)',
  'cat-tracker': 'Cat Tracker (/cat-tracker)',
  'camel-up-cup': 'Camel Up Cup (/camel-up-cup)',
  'bouldering-tracker': 'Bouldering Tracker (/bouldering-tracker)',
  'generative-art': 'Generative Art (/generative-art)',
  'the-riddler': 'The Riddler (/the-riddler)',
  set: 'Set (/set)',
  ssbm: 'SSBM (/SSBM)',
};

/** Scopes for work that belongs to no single project. */
export const SHARED = {
  chess: 'the chess plumbing several projects share (board, engine, move helpers)',
  site: 'the site shell: navbar, footer, shared components, copy, favicon, layout',
  blog: 'blog posts and their pipeline (/blog)',
  og: 'OG share cards and their generator',
  release: 'semantic-release commits (written by the release bot)',
  deps: 'dependency updates',
};

export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', [...Object.keys(PROJECTS), ...Object.keys(SHARED)]],
  },
};
