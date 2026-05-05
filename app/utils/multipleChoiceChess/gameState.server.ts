import { getRedisClient } from "~/utils/redis.server";

const PREFIX = 'multipleChoiceChess';
const TTL = 24 * 60 * 60; // 24 hours

export interface GameState {
  fen: string;
  turn: 'white' | 'black';
  white_id: string;
  black_id: string;
  white_score: number;
  black_score: number;
  white_moves: number;
  black_moves: number;
  status: 'waiting' | 'active' | 'complete';
  result: 'white' | 'black' | 'draw' | '';
  result_reason: string;
  last_move: string;
  last_move_rank: number;
  last_move_choices: string; // JSON array of 4 UCI moves
  created_at: number;
  last_updated: number;
}

export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function gameKey(gameId: string): string {
  return `${PREFIX}:game:${gameId}`;
}

const AVAILABLE_KEY = `${PREFIX}:available`;

export function generateGameId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function generatePlayerId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseGame(data: Record<string, string>): GameState {
  return {
    fen: data.fen,
    turn: data.turn as 'white' | 'black',
    white_id: data.white_id,
    black_id: data.black_id,
    white_score: Number(data.white_score),
    black_score: Number(data.black_score),
    white_moves: Number(data.white_moves),
    black_moves: Number(data.black_moves),
    status: data.status as 'waiting' | 'active' | 'complete',
    result: data.result as 'white' | 'black' | 'draw' | '',
    result_reason: data.result_reason,
    last_move: data.last_move,
    last_move_rank: Number(data.last_move_rank),
    last_move_choices: data.last_move_choices,
    created_at: Number(data.created_at),
    last_updated: Number(data.last_updated),
  };
}

export async function createGame(gameId: string, playerId: string): Promise<GameState> {
  const redis = getRedisClient();
  const now = Date.now();

  const state: GameState = {
    fen: INITIAL_FEN,
    turn: 'white',
    white_id: playerId,
    black_id: '',
    white_score: 0,
    black_score: 0,
    white_moves: 0,
    black_moves: 0,
    status: 'waiting',
    result: '',
    result_reason: '',
    last_move: '',
    last_move_rank: 0,
    last_move_choices: '[]',
    created_at: now,
    last_updated: now,
  };

  await redis.hset(gameKey(gameId), {
    fen: state.fen,
    turn: state.turn,
    white_id: state.white_id,
    black_id: state.black_id,
    white_score: '0',
    black_score: '0',
    white_moves: '0',
    black_moves: '0',
    status: state.status,
    result: '',
    result_reason: '',
    last_move: '',
    last_move_rank: '0',
    last_move_choices: '[]',
    created_at: String(now),
    last_updated: String(now),
  });
  await redis.expire(gameKey(gameId), TTL);
  await redis.zadd(AVAILABLE_KEY, now, gameId);

  return state;
}

export async function getGame(gameId: string): Promise<GameState | null> {
  const redis = getRedisClient();
  const data = await redis.hgetall(gameKey(gameId));
  if (!data || !data.fen) return null;
  return parseGame(data);
}

export async function joinGame(gameId: string, playerId: string): Promise<GameState | null> {
  const redis = getRedisClient();
  const game = await getGame(gameId);

  if (!game || game.status !== 'waiting') return null;

  const now = Date.now();
  await redis.hset(gameKey(gameId), {
    black_id: playerId,
    status: 'active',
    last_updated: String(now),
  });
  await redis.expire(gameKey(gameId), TTL);
  await redis.zrem(AVAILABLE_KEY, gameId);

  return { ...game, black_id: playerId, status: 'active', last_updated: now };
}

export interface MoveUpdate {
  fen: string;
  turn: 'white' | 'black';
  move: string;
  rank: number;
  choices: string[];
  whiteScore: number;
  blackScore: number;
  whiteMoves: number;
  blackMoves: number;
  status: 'active' | 'complete';
  result: 'white' | 'black' | 'draw' | '';
  resultReason: string;
}

export async function applyMove(gameId: string, update: MoveUpdate): Promise<void> {
  const redis = getRedisClient();
  const now = Date.now();

  await redis.hset(gameKey(gameId), {
    fen: update.fen,
    turn: update.turn,
    last_move: update.move,
    last_move_rank: String(update.rank),
    last_move_choices: JSON.stringify(update.choices),
    white_score: String(update.whiteScore),
    black_score: String(update.blackScore),
    white_moves: String(update.whiteMoves),
    black_moves: String(update.blackMoves),
    status: update.status,
    result: update.result,
    result_reason: update.resultReason,
    last_updated: String(now),
  });
  await redis.expire(gameKey(gameId), TTL);
}

export async function resignGame(
  gameId: string,
  resigningColor: 'white' | 'black',
): Promise<void> {
  const redis = getRedisClient();
  const now = Date.now();
  const winner = resigningColor === 'white' ? 'black' : 'white';

  await redis.hset(gameKey(gameId), {
    status: 'complete',
    result: winner,
    result_reason: 'resignation',
    last_updated: String(now),
  });
  await redis.expire(gameKey(gameId), TTL);
}

export interface AvailableGame {
  game_id: string;
  created_at: number;
}

export async function getAvailableGames(): Promise<AvailableGame[]> {
  const redis = getRedisClient();

  // Prune stale entries (games that joined or expired but weren't removed from set)
  const cutoff = Date.now() - TTL * 1000;
  await redis.zremrangebyscore(AVAILABLE_KEY, '-inf', cutoff);

  const results = await redis.zrangebyscore(
    AVAILABLE_KEY,
    '-inf',
    '+inf',
    'WITHSCORES',
  );

  const games: AvailableGame[] = [];
  for (let i = 0; i < results.length; i += 2) {
    const gameId = results[i];
    const score = Number(results[i + 1]);

    // Verify it still exists and is waiting
    const game = await getGame(gameId);
    if (game && game.status === 'waiting') {
      games.push({ game_id: gameId, created_at: score });
    } else {
      // Clean up stale entry
      await redis.zrem(AVAILABLE_KEY, gameId);
    }
  }

  return games.reverse(); // Most recent first
}
