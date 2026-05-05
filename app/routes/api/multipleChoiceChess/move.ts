import type { ActionFunctionArgs } from "react-router";
import { Chess } from "chess.js";
import {
  getGame,
  applyMove,
} from "~/utils/multipleChoiceChess/gameState.server";
import { pointsForRank } from "~/utils/multipleChoiceChess/scoring";

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

    if (!gameId || !playerId || !move || !rank || !choices) {
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

    const result = chess.move({ from, to, promotion });
    if (!result) {
      return Response.json({ error: 'Illegal move' }, { status: 400 });
    }

    const newFen = chess.fen();
    const nextTurn: 'white' | 'black' = game.turn === 'white' ? 'black' : 'white';

    const points = pointsForRank(rank);
    const newWhiteScore = game.white_score + (isWhite ? points : 0);
    const newBlackScore = game.black_score + (isBlack ? points : 0);
    const newWhiteMoves = game.white_moves + (isWhite ? 1 : 0);
    const newBlackMoves = game.black_moves + (isBlack ? 1 : 0);

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
