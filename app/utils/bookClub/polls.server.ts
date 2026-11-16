import { createHash, randomBytes } from 'node:crypto';
import { getRedisClient } from '~/utils/redis.server';
import { RETENTION_SECONDS, normalizeBallot, type Ballot, type Book, type PollView } from './types';

interface Voter {
  name: string;
  nameKey: string;
  joinedAt: number;
  ballot: (Omit<Ballot, 'down'> & { down: string | string[] }) | string | null;
}
interface StoredPoll {
  id: string;
  title: string;
  books: Book[];
  upVotes?: number;
  downVotes?: number;
  allowMultipleVotes?: boolean;
  expiresAt: number;
  closed: boolean;
  hostHash: string;
  voters: Record<string, Voter>;
}
export const validId = (id: string) => /^[a-f0-9]{24}$/.test(id);
export const validToken = (token: string) => /^[a-f0-9]{64}$/.test(token);
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const key = (id: string) => `bookClub:poll:${id}`;
export class PollError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') throw new PollError('Please enter text.');
  const text = value.trim().replace(/\s+/g, ' ');
  if (!text || text.length > max || [...text].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))
    throw new PollError(`Please use between 1 and ${max} characters.`);
  return text;
}
export function validateList(body: Record<string, unknown>) {
  const title = cleanText(body.title, 120);
  if (!Array.isArray(body.books) || body.books.length < 3 || body.books.length > 30)
    throw new PollError('Add between 3 and 30 books.');
  const books = body.books.map((book) => cleanText(book, 200));
  if (new Set(books.map((b) => b.normalize('NFKC').toLowerCase())).size !== books.length)
    throw new PollError('Each book must be different.');
  const upVotes = body.upVotes === undefined ? 2 : body.upVotes;
  const downVotes = body.downVotes === undefined ? 1 : body.downVotes;
  const allowMultipleVotes = body.allowMultipleVotes === undefined ? false : body.allowMultipleVotes;
  if (
    typeof upVotes !== 'number' ||
    typeof downVotes !== 'number' ||
    !Number.isInteger(upVotes) ||
    !Number.isInteger(downVotes) ||
    upVotes < 0 ||
    downVotes < 0 ||
    upVotes > 30 ||
    downVotes > 30 ||
    upVotes + downVotes === 0
  )
    throw new PollError('Set each vote allowance to 0–30, with at least one vote in total.');
  if (typeof allowMultipleVotes !== 'boolean') throw new PollError('Invalid multiple-vote setting.');
  return { title, books, upVotes, downVotes, allowMultipleVotes };
}
export async function createPoll(input: ReturnType<typeof validateList>) {
  const id = randomBytes(12).toString('hex');
  const hostToken = randomBytes(32).toString('hex');
  const poll: StoredPoll = {
    id,
    title: input.title,
    upVotes: input.upVotes,
    downVotes: input.downVotes,
    allowMultipleVotes: input.allowMultipleVotes,
    books: input.books.map((title, i) => ({ id: String(i + 1), title })),
    expiresAt: Date.now() + RETENTION_SECONDS * 1000,
    closed: false,
    hostHash: hash(hostToken),
    voters: {},
  };
  const saved = await getRedisClient().set(key(id), JSON.stringify(poll), 'EX', RETENTION_SECONDS, 'NX');
  if (saved !== 'OK') throw new PollError('Could not create a vote. Please try again.', 503);
  return { id, hostToken };
}

// One key and one atomic mutation: concurrent joins, final ballots and closing
// cannot overwrite each other. KEEPTTL preserves the creation-time 30-day expiry.
export const MUTATE_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'missing' end
local p = cjson.decode(raw)
local a = cjson.decode(ARGV[1])
if a.kind == 'close' then
  if p.hostHash ~= a.token then return 'forbidden' end
  p.closed = true
elseif a.kind == 'join' then
  if p.voters[a.token] then return 'ok' end
  if p.closed then return 'closed' end
  local count = 0
  for _, v in pairs(p.voters) do
    if v.nameKey == a.nameKey then return 'name' end
    count = count + 1
  end
  if count >= 100 then return 'full' end
  p.voters[a.token] = {name=a.name, nameKey=a.nameKey, joinedAt=a.joinedAt, ballot=cjson.null}
elseif a.kind == 'vote' then
  if p.closed then return 'closed' end
  local v = p.voters[a.token]
  if not v then return 'forbidden' end
  if v.ballot ~= cjson.null then return 'locked' end
  local ids = {}
  for _, b in ipairs(p.books) do ids[b.id] = true end
  if #a.ballot.up > (p.upVotes or 2) or #a.ballot.down > (p.downVotes or 1) then return 'quota' end
  local used = {}
  for _, side in ipairs({'up', 'down'}) do
    for _, id in ipairs(a.ballot[side]) do
      if not ids[id] then return 'ballot' end
      if used[id] and (used[id] ~= side or not p.allowMultipleVotes) then return 'ballot' end
      used[id] = side
    end
  end
  -- cjson turns empty arrays into objects; keep the ballot's JSON text intact.
  v.ballot = a.ballotJson
else return 'forbidden' end
redis.call('SET', KEYS[1], cjson.encode(p), 'KEEPTTL')
return 'ok'
`;
export async function mutatePoll(id: string, token: string, input: Record<string, unknown>) {
  const result = await getRedisClient().eval(
    MUTATE_SCRIPT,
    1,
    key(id),
    JSON.stringify({
      ...input,
      token: hash(token),
      joinedAt: Date.now(),
      ballotJson: input.kind === 'vote' ? JSON.stringify(input.ballot) : undefined,
    }),
  );
  const errors: Record<string, [string, number]> = {
    missing: ['This vote has expired or does not exist.', 404],
    forbidden: ['This link or voter session is not valid.', 403],
    closed: ['Voting is closed.', 409],
    name: ['That name is already in use. Add a surname or initial.', 409],
    full: ['This vote has reached 100 voters.', 409],
    locked: ['Your votes are already locked in.', 409],
    ballot: ['Choose valid books without mixing upvotes and downvotes on one book.', 400],
    quota: ['Vote allowance exceeded.', 400],
  };
  if (result !== 'ok') {
    const [message, status] = errors[String(result)] ?? ['Could not save changes.', 503];
    throw new PollError(message, status);
  }
}
export async function readPoll(id: string, token: string): Promise<PollView> {
  const raw = await getRedisClient().get(key(id));
  if (!raw) throw new PollError('This vote has expired or does not exist.', 404);
  const p: StoredPoll = JSON.parse(raw);
  const tokenHash = hash(token);
  const host = validToken(token) && p.hostHash === tokenHash;
  const self = p.voters[tokenHash];
  const voters = Object.values(p.voters)
    .map((v) => ({
      ...v,
      ballot: v.ballot ? normalizeBallot(typeof v.ballot === 'string' ? JSON.parse(v.ballot) : v.ballot) : null,
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt || a.name.localeCompare(b.name));
  const view: PollView = {
    id: p.id,
    title: p.title,
    books: p.books,
    upVotes: p.upVotes ?? 2,
    downVotes: p.downVotes ?? 1,
    allowMultipleVotes: p.allowMultipleVotes ?? false,
    expiresAt: p.expiresAt,
    closed: p.closed,
    host,
    self: self
      ? {
          name: self.name,
          ballot: self.ballot
            ? normalizeBallot(typeof self.ballot === 'string' ? JSON.parse(self.ballot) : self.ballot)
            : null,
        }
      : null,
  };
  if (host) view.participants = voters.map((v) => ({ name: v.name, locked: Boolean(v.ballot) }));
  if (p.closed)
    view.results = p.books
      .map((book) => {
        const up = voters.reduce((sum, v) => sum + (v.ballot?.up.filter((id) => id === book.id).length ?? 0), 0);
        const down = voters.reduce((sum, v) => sum + (v.ballot?.down.filter((id) => id === book.id).length ?? 0), 0);
        return { ...book, up, down, score: up - down };
      })
      .sort((a, b) => b.score - a.score || Number(a.id) - Number(b.id));
  return view;
}
