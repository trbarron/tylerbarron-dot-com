import type { ActionFunctionArgs } from "react-router";
import { Chess } from "chess.js";
import {
  getGame,
  applyMove,
} from "~/utils/multipleChoiceChess/gameState.server";
import { pointsForRank } from "~/utils/multipleChoiceChess/scoring";

function incrementRankCounts(
  rank: number,
  rank1: number,
  rank2: number,
  rank4: number,
  rank6: number,
) {
  return {
    rank1: rank1 + (rank === 1 ? 1 : 0),
    rank2: rank2 + (rank === 2 ? 1 : 0),
    rank4: rank4 + (rank === 4 ? 1 : 0),
    rank6: rank6 + (rank === 6 ? 1 : 0),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json() as {
      game_id: string;
      player_id: string;
      move: string;       // UCI notation e.g. "e2e4"
      rank: number;       // 1 | 2 | 4 | 6
      choices: string[];  // all four UCI moves that were shown
    };

    const { game_id: gameId, player_id: playerId, move, rank, choices } = body;

    if (!gameId || !playerId || !move || rank === undefined || rank === null || !choices) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const game = await getGame(gameId.toLowerCase().trim());
    if (!game) {
      return Response.json({ error: 'Game not found' }, { status: 404 });
    }
    if (game.status !== 'active') {
      return Response.json({ error: 'Game is not active' }, { status: 409 });
    }

    // Verify it's this player's turn
    const isWhite = game.white_id === playerId;
    const isBlack = game.black_id === playerId;
    if (!isWhite && !isBlack) {
      return Response.json({ error: 'Not a player in this game' }, { status: 403 });
    }
    const playerColor = isWhite ? 'white' : 'black';
    if (game.turn !== playerColor) {
      return Response.json({ error: 'Not your turn' }, { status: 409 });
    }

    // Apply move and compute new game state
    const chess = new Chess(game.fen);
    const from = move.slice(0, 2);
    const to = move.slice(2, 4);
    const promotion = move.length === 5 ? move[4] : undefined;

    try {
      chess.move({ from, to, promotion });
    } catch {
      return Response.json({ error: 'Illegal move' }, { status: 400 });
    }

    const newFen = chess.fen();
    const nextTurn: 'white' | 'black' = game.turn === 'white' ? 'black' : 'white';

    const points = pointsForRank(rank);
    const newWhiteScore = game.white_score + (isWhite ? points : 0);
    const newBlackScore = game.black_score + (isBlack ? points : 0);
    const newWhiteMoves = game.white_moves + (isWhite ? 1 : 0);
    const newBlackMoves = game.black_moves + (isBlack ? 1 : 0);
    const whiteRanks = isWhite
      ? incrementRankCounts(
          rank,
          game.white_rank_1,
          game.white_rank_2,
          game.white_rank_4,
          game.white_rank_6,
        )
      : {
          rank1: game.white_rank_1,
          rank2: game.white_rank_2,
          rank4: game.white_rank_4,
          rank6: game.white_rank_6,
        };
    const blackRanks = isBlack
      ? incrementRankCounts(
          rank,
          game.black_rank_1,
          game.black_rank_2,
          game.black_rank_4,
          game.black_rank_6,
        )
      : {
          rank1: game.black_rank_1,
          rank2: game.black_rank_2,
          rank4: game.black_rank_4,
          rank6: game.black_rank_6,
        };

    // Determine game over
    let status: 'active' | 'complete' = 'active';
    let gameResult: 'white' | 'black' | 'draw' | '' = '';
    let resultReason = '';

    if (chess.isCheckmate()) {
      status = 'complete';
      gameResult = game.turn; // the player who just moved wins
      resultReason = 'checkmate';
    } else if (chess.isDraw()) {
      status = 'complete';
      gameResult = 'draw';
      resultReason = chess.isStalemate()
        ? 'stalemate'
        : chess.isInsufficientMaterial()
          ? 'insufficient_material'
          : 'repetition';
    }

    await applyMove(gameId, {
      fen: newFen,
      turn: nextTurn,
      move,
      rank,
      choices,
      whiteScore: newWhiteScore,
      blackScore: newBlackScore,
      whiteMoves: newWhiteMoves,
      blackMoves: newBlackMoves,
      whiteRank1: whiteRanks.rank1,
      whiteRank2: whiteRanks.rank2,
      whiteRank4: whiteRanks.rank4,
      whiteRank6: whiteRanks.rank6,
      blackRank1: blackRanks.rank1,
      blackRank2: blackRanks.rank2,
      blackRank4: blackRanks.rank4,
      blackRank6: blackRanks.rank6,
      status,
      result: gameResult,
      resultReason,
    });

    return Response.json({ ok: true, status, result: gameResult, result_reason: resultReason });
  } catch (err) {
    console.error('Move error:', err);
    return Response.json({ error: 'Failed to apply move' }, { status: 500 });
  }
}
