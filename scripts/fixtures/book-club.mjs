// Synthetic data, used only by the screenshot browser. No Redis or production writes.
export function scenarios() {
  const id = '0123456789abcdef01234567';
  const hostToken = 'a'.repeat(64);
  const voterToken = 'b'.repeat(64);
  const books = [
    { id: '1', title: 'Go Dog Go' },
    { id: '2', title: 'Fox in Socks' },
    { id: '3', title: 'A Gentleman in Moscow' },
  ];
  const ballot = { up: ['1', '3'], down: '2' };
  const results = [
    { ...books[2], up: 2, down: 0, score: 2 },
    { ...books[0], up: 1, down: 0, score: 1 },
    { ...books[1], up: 1, down: 2, score: -1 },
  ];
  const poll = {
    id,
    title: 'Test Book Club #1',
    books,
    expiresAt: Date.UTC(2026, 11, 13),
    closed: false,
    host: false,
    self: null,
  };
  const path = `/book-club/${id}`;
  const voter = { ...poll, self: { name: 'Ted', ballot: null } };
  // Include the legacy running totals so the before view can show their removal.
  const host = {
    ...poll,
    host: true,
    participants: [
      { name: 'Ted', locked: true },
      { name: 'Sam', locked: true },
      { name: 'Alex', locked: false },
    ],
    results,
  };
  const capture = (name, title, view, role, extra = {}) => ({
    name,
    title,
    route: role === 'host' ? `${path}/host` : path,
    storage: role ? { [`bookClub:${role}:${id}`]: role === 'host' ? hostToken : voterToken } : {},
    responses: { [`/api/bookClub/poll?id=${id}`]: view },
    ...extra,
  });
  return [
    { name: 'create', title: 'Create a vote', route: '/book-club', readySelector: '#book-list' },
    capture('join', 'Join from invite', poll, null, { readySelector: 'input[autocomplete="name"]' }),
    capture('ballot', 'Choose votes', voter, 'voter', { readySelector: 'button[aria-label="Upvote Go Dog Go"]' }),
    capture('confirm', 'Confirm ballot', voter, 'voter', {
      readySelector: 'button[aria-label="Upvote Go Dog Go"]',
      steps: [
        'button[aria-label="Upvote Go Dog Go"]',
        'button[aria-label="Upvote A Gentleman in Moscow"]',
        'button[aria-label="Downvote Fox in Socks"]',
        'button:has-text("Lock in my votes")',
      ],
      finalReady: 'dialog[open]',
    }),
    capture('locked', 'Locked-in ballot', { ...voter, self: { name: 'Ted', ballot } }, 'voter', {
      readySelector: 'main section p:has-text("Your ballot is final")',
    }),
    capture('host', 'Host dashboard', host, 'host', { readySelector: '#invite-link' }),
    capture('host-link', 'Private host link', host, 'host', {
      readySelector: '#invite-link',
      steps: ['summary:has-text("Save your private host link")'],
      finalReady: 'details[open]',
    }),
    capture('close', 'Confirm closing', host, 'host', {
      readySelector: '#invite-link',
      steps: ['button:has-text("Close voting & reveal results")'],
      finalReady: 'dialog[open]',
    }),
    capture('results', 'Closed results', { ...poll, closed: true, results }, null, {
      readySelector: 'main section ol',
    }),
  ];
}
