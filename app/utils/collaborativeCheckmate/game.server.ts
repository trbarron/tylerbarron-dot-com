// Collaborative Checkmate's state in Redis. There's no game server: every
// request loads the game, applies the rules (rules.ts) and saves it, and the
// state polls double as the clock. Whichever poll arrives after a turn's
// deadline decides the move, running Stockfish here when teammates disagree.
// Layout and concurrency: docs/collaborative-checkmate.md.

import { openGames } from '~/utils/multiplayer/openGames.server';
import { getRedisClient } from '~/utils/redis.server';
import { evaluate, scoreValue } from '~/utils/stockfish.server';
import {
  act,
  applyMove,
  beginCompute,
  chooseMove,
  due,
  isOpen,
  join,
  newGame,
  publicView,
  seatOf,
  start,
  vacateStale,
  type Game,
  type MoveJudge,
} from './rules';
import { GamePhase, type PlayerAction, type PublicGame } from './types';

const PREFIX = 'collaborativeCheckmate';
const TTL_MS = 24 * 60 * 60 * 1000;
/** The lobby lists a game for this long after it's created. */
const LOBBY_MS = 20 * 60 * 1000;
/** Presence is written at most this often per player, to keep polls to one Redis round trip. */
const SEEN_WRITE_MS = 3_000;
const LOCK_MS = 15_000;
const FINISHED_KEEP = 200;

const gameKey = (id: string) => `${PREFIX}:game:${id}`;
const seenKey = (id: string) => `${PREFIX}:seen:${id}`;
const lockKey = (id: string) => `${PREFIX}:lock:${id}`;
const STATS_KEY = `${PREFIX}:stats`;
const FINISHED_KEY = `${PREFIX}:finished`;

const lobby = openGames(`${PREFIX}:open`, LOBBY_MS);

// Save only if nobody else saved since we read: version must still match.
const CAS_SCRIPT = `
local v = redis.call('HGET', KEYS[1], 'version')
if (v or '') ~= ARGV[1] then return 0 end
redis.call('HSET', KEYS[1], 'data', ARGV[2], 'version', tostring((tonumber(v) or 0) + 1))
redis.call('PEXPIRE', KEYS[1], ARGV[3])
return 1`;

interface Loaded {
  game: Game | null;
  version: string;
  seen: Record<string, number>;
}

async function load(id: string): Promise<Loaded> {
  const results = await getRedisClient().multi().hmget(gameKey(id), 'data', 'version').hgetall(seenKey(id)).exec();
  const [data, version] = (results?.[0]?.[1] as (string | null)[]) ?? [null, null];
  const seenRaw = (results?.[1]?.[1] as Record<string, string>) ?? {};
  return {
    game: data ? (JSON.parse(data) as Game) : null,
    version: version ?? '',
    seen: Object.fromEntries(Object.entries(seenRaw).map(([k, v]) => [k, Number(v)])),
  };
}

/**
 * Apply `change` to the stored game and save it, retrying on a concurrent
 * save. Returns the stored game afterwards (unchanged when `change` returns
 * its input).
 */
async function update(
  id: string,
  change: (game: Game | null, seen: Record<string, number>) => Game | null,
): Promise<Game | null> {
  const redis = getRedisClient();
  for (let attempt = 0; attempt < 8; attempt++) {
    const { game, version, seen } = await load(id);
    const next = change(game, seen);
    if (!next || next === game) return game;
    const saved = await redis.eval(CAS_SCRIPT, 1, gameKey(id), version, JSON.stringify(next), String(TTL_MS));
    if (saved === 1) return next;
  }
  throw new Error('The game is busy. Try again.');
}

/** Record that `player` is still here. Throttled unless `force`; also updates `seen` in place. */
async function touch(
  id: string,
  player: string,
  seen: Record<string, number>,
  now: number,
  force = false,
): Promise<void> {
  if (!force && now - (seen[player] ?? 0) < SEEN_WRITE_MS) return;
  seen[player] = now;
  await getRedisClient().multi().hset(seenKey(id), player, String(now)).pexpire(seenKey(id), TTL_MS).exec();
}

/** Black's score is the negation of the position's score for the side to move. */
const judge: MoveJudge = async (fenAfterMove) => -scoreValue(await evaluate(fenAfterMove));

async function recordFinish(game: Game, now: number): Promise<void> {
  const { result } = game;
  if (!result) return;
  const players = Object.fromEntries(Object.entries(game.seats).map(([seat, s]) => [seat, s.player]));
  await getRedisClient()
    .multi()
    .hincrby(STATS_KEY, 'games_finished', 1)
    .hincrby(STATS_KEY, result.winner ? `${result.winner}_wins` : 'draws', 1)
    .hincrby(STATS_KEY, 'moves', game.moves.length)
    .hincrby(STATS_KEY, 'same_moves', game.sameMoves.t1 + game.sameMoves.t2)
    .hincrby(STATS_KEY, 'judged_moves', game.judgedMoves)
    .lpush(
      FINISHED_KEY,
      JSON.stringify({
        id: game.id,
        endedAt: now,
        startedAt: game.createdAt,
        result,
        moves: game.moves.length,
        sameMoves: game.sameMoves,
        judgedMoves: game.judgedMoves,
        players,
      }),
    )
    .ltrim(FINISHED_KEY, 0, FINISHED_KEEP - 1)
    .exec();
}

/** Do whatever the game is waiting for: free abandoned seats, start, or decide a move. */
async function advance(id: string, loaded: Loaded): Promise<Game | null> {
  let game = loaded.game;
  if (!game) return null;
  const now = Date.now();

  if (vacateStale(game, loaded.seen, now) !== game) {
    // Re-checked against fresh presence on every retry, so a player who just sat down isn't dropped.
    game = await update(id, (g, seen) => (g ? vacateStale(g, seen, Date.now()) : g));
    if (!game) return null;
  }

  const next = due(game, now);
  if (next === 'start') {
    const before = game;
    game = await update(id, (g) => (g && due(g, Date.now()) === 'start' ? start(g, Date.now()) : g));
    if (game && game !== before && game.phase !== GamePhase.SETUP) {
      await Promise.all([lobby.remove(id), getRedisClient().hincrby(STATS_KEY, 'games_started', 1)]);
    }
    return game;
  }
  if (next !== 'compute') return game;

  // One request decides the move; the rest keep polling and see "computing".
  const redis = getRedisClient();
  if ((await redis.set(lockKey(id), '1', 'PX', LOCK_MS, 'NX')) !== 'OK') return game;
  try {
    // Decide only if this request is the one that marked the turn as computing:
    // the lock already ensures that, and this still holds if the lock expired.
    let began = false;
    const computing = await update(id, (g) => {
      began = Boolean(g && due(g, Date.now()) === 'compute');
      return g && began ? beginCompute(g, Date.now()) : g;
    });
    if (!computing || !began) return computing;
    const ply = computing.moves.length;
    const phase = computing.phase;
    const choice = await chooseMove(computing, judge);
    const after = await update(id, (g) =>
      g && g.phase === phase && g.moves.length === ply ? applyMove(g, choice, Date.now()) : g,
    );
    if (after?.result && after.moves.length === ply + 1) await recordFinish(after, Date.now());
    return after;
  } finally {
    await redis.del(lockKey(id));
  }
}

/** Open (or create) a game and seat the player if a seat is free; a full game just watches. */
export async function joinGame(id: string, player: string, isPrivate: boolean): Promise<PublicGame> {
  // Present before seated, so no concurrent poll sees a seated player with no presence.
  await touch(id, player, {}, Date.now(), true);
  let created = false;
  await update(id, (g) => {
    if (g) return join(g, player, Date.now());
    created = true;
    return join(newGame(id, isPrivate, Date.now()), player, Date.now());
  });
  if (created && !isPrivate) await lobby.add(id);
  const loaded = await load(id);
  return publicView((await advance(id, loaded)) ?? loaded.game!, player, Date.now());
}

/** The poll: the game as this player sees it, after any due transition. Null if it doesn't exist (or expired). */
export async function getGame(id: string, player: string | null): Promise<PublicGame | null> {
  const loaded = await load(id);
  if (!loaded.game) return null;
  const now = Date.now();
  if (player && seatOf(loaded.game, player)) await touch(id, player, loaded.seen, now);
  const game = (await advance(id, loaded)) ?? loaded.game;
  return publicView(game, player, Date.now());
}

export async function playerAction(
  id: string,
  player: string,
  action: PlayerAction,
): Promise<{ game: PublicGame | null; error?: string }> {
  await touch(id, player, {}, Date.now(), true);
  let error: string | undefined;
  await update(id, (g) => {
    if (!g) return g;
    const result = act(g, player, action, Date.now());
    error = result.error;
    return result.game;
  });
  const loaded = await load(id);
  if (!loaded.game) return { game: null, error: 'Game not found.' };
  const game = (await advance(id, loaded)) ?? loaded.game;
  return { game: publicView(game, player, Date.now()), error };
}

export interface LobbyGame {
  game_id: string;
  created_time: number;
  occupied_seats: number;
}

export async function listOpenGames(): Promise<LobbyGame[]> {
  return lobby.list(async (id) => {
    const { game } = await load(id);
    if (!game || !isOpen(game, Date.now(), LOBBY_MS)) return null;
    return {
      game_id: id,
      created_time: game.createdAt,
      occupied_seats: Object.values(game.seats).filter((s) => s.player).length,
    };
  });
}
