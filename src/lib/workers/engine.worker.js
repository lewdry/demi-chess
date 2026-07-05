import { getLegalMoves, simulateMove, isSquareAttacked } from '../engine/game.js';
import { PIECES, COLORS, EMPTY } from '../engine/board.js';

// Piece values for evaluation
const PIECE_VALUES = {
  [PIECES.PAWN]: 100,
  [PIECES.KNIGHT]: 300,
  [PIECES.BISHOP]: 300,
  [PIECES.ROOK]: 500,
  [PIECES.QUEEN]: 900,
  [PIECES.KING]: 20000 // effectively infinity
};

// Piece-square tables, one 4x8 grid (row 0 = rank 8, row 7 = rank 1) per piece type,
// written from White's perspective. Values are added to material score based on
// where a piece sits, so pieces prefer good squares in addition to just existing.
// Bishop diagonals cap out at length 4 on this board (vs 8 on a full board), so its
// table is deliberately flatter/smaller than the knight's rather than mirroring it.
const PAWN_PST = [
   0,  0,  0,  0,
  80, 80, 80, 80,
  50, 55, 55, 50,
  25, 30, 30, 25,
  12, 18, 18, 12,
   6, 10, 10,  6,
   0,  0,  0,  0,
   0,  0,  0,  0
];

const KNIGHT_PST = [
  -20, -10, -10, -20,
  -10,   5,   5, -10,
  -10,  10,  10, -10,
  -10,  15,  15, -10,
  -10,  15,  15, -10,
  -10,  10,  10, -10,
  -10,   5,   5, -10,
  -20, -10, -10, -20
];

const BISHOP_PST = [
  -10,  -5,  -5, -10,
   -5,   5,   5,  -5,
   -5,  10,  10,  -5,
   -5,  10,  10,  -5,
   -5,  10,  10,  -5,
   -5,  10,  10,  -5,
   -5,   5,   5,  -5,
  -10,  -5,  -5, -10
];

const ROOK_PST = [
  10, 10, 10, 10,
   5,  5,  5,  5,
   0,  0,  0,  0,
   0,  0,  0,  0,
   0,  0,  0,  0,
   0,  0,  0,  0,
   0,  5,  5,  0,
   0,  0,  0,  0
];

const QUEEN_PST = [
  0,  5,  5, 0,
  5, 10, 10, 5,
  5, 10, 10, 5,
  5, 10, 10, 5,
  5, 10, 10, 5,
  5, 10, 10, 5,
  5, 10, 10, 5,
  0,  5,  5, 0
];

const KING_PST = [
  -30, -30, -30, -30,
  -20, -20, -20, -20,
  -20, -20, -20, -20,
  -10, -10, -10, -10,
  -10, -10, -10, -10,
   10,  10,  10,  10,
   20,  30,  30,  20,
   30,  40,  40,  30
];

const PST = {
  [PIECES.PAWN]: PAWN_PST,
  [PIECES.KNIGHT]: KNIGHT_PST,
  [PIECES.BISHOP]: BISHOP_PST,
  [PIECES.ROOK]: ROOK_PST,
  [PIECES.QUEEN]: QUEEN_PST,
  [PIECES.KING]: KING_PST
};

// Mirrors a square index vertically (row r <-> row 7-r) so Black can reuse White's tables.
function mirrorSquare(index) {
  const row = Math.floor(index / 4);
  const col = index % 4;
  return (7 - row) * 4 + col;
}

// Material + piece-square table evaluation.
// Returns a positive score if white is leading, negative if black is leading.
function evaluate(board) {
  let score = 0;
  for (let i = 0; i < 32; i++) {
    const piece = board[i];
    if (piece !== EMPTY) {
      const table = PST[piece.type];
      const squareIndex = piece.color === COLORS.WHITE ? i : mirrorSquare(i);
      const value = PIECE_VALUES[piece.type] + (table ? table[squareIndex] : 0);
      score += piece.color === COLORS.WHITE ? value : -value;
    }
  }
  return score;
}

// Depth is measured in plies (half-moves). A depth of 4 means the engine looks ahead 2 full turns.
const MAX_DEPTH = 4;
const MATE_SCORE = 100000;

// "Take it easy" mode: a much shallower search plus a chance to play a random
// legal move outright, so the CPU blunders far more often.
const EASY_MAX_DEPTH = 1;
const EASY_RANDOM_MOVE_CHANCE = 0.4;

function findKingSquare(board, color) {
  for (let i = 0; i < 32; i++) {
    if (board[i] && board[i].type === PIECES.KING && board[i].color === color) {
      return i;
    }
  }
  return -1;
}

// Applies a move and derives the next lightweight search state (no history, unlike applyMoveToState).
function getNextState(state, move) {
  const piece = state.board[move.from];
  const nextBoard = simulateMove(state.board, move);

  const newCastlingRights = { ...state.castlingRights };
  if (piece.type === PIECES.KING) newCastlingRights[piece.color] = false;
  if (piece.type === PIECES.ROOK) {
    if (move.from === 31 && piece.color === COLORS.WHITE) newCastlingRights.w = false;
    if (move.from === 3 && piece.color === COLORS.BLACK) newCastlingRights.b = false;
  }
  if (move.to === 31) newCastlingRights.w = false;
  if (move.to === 3) newCastlingRights.b = false;

  let newEpTarget = null;
  if (piece.type === PIECES.PAWN && Math.abs(Math.floor(move.to / 4) - Math.floor(move.from / 4)) === 2) {
    newEpTarget = piece.color === COLORS.WHITE ? move.from - 4 : move.from + 4;
  }

  return {
    board: nextBoard,
    turn: state.turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE,
    castlingRights: newCastlingRights,
    enPassantTarget: newEpTarget
  };
}

function minimax(state, depth, alpha, beta, maximizingPlayer) {
  const legalMoves = getLegalMoves(state.board, state.turn, state.castlingRights[state.turn], state.enPassantTarget);

  // No legal moves: checkmate or stalemate, regardless of remaining depth.
  if (legalMoves.length === 0) {
    const kingSquare = findKingSquare(state.board, state.turn);
    const opponentColor = state.turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
    const inCheck = kingSquare !== -1 && isSquareAttacked(kingSquare, state.board, opponentColor);

    if (!inCheck) return 0; // Stalemate is a draw.

    // Checkmate: the side to move has lost. Add remaining depth so the search
    // prefers faster mates (found with more depth left) over slower ones.
    const mateScore = MATE_SCORE + depth;
    return state.turn === COLORS.WHITE ? -mateScore : mateScore;
  }

  if (depth === 0) {
    return evaluate(state.board);
  }

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of legalMoves) {
      const nextState = getNextState(state, move);
      const evalScore = minimax(nextState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break; // Beta cutoff
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of legalMoves) {
      const nextState = getNextState(state, move);
      const evalScore = minimax(nextState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break; // Alpha cutoff
    }
    return minEval;
  }
}

function findBestMove(state, easyMode) {
  const legalMoves = getLegalMoves(state.board, state.turn, state.castlingRights[state.turn], state.enPassantTarget);
  if (legalMoves.length === 0) return null;

  if (easyMode && Math.random() < EASY_RANDOM_MOVE_CHANCE) {
    return legalMoves[Math.floor(Math.random() * legalMoves.length)];
  }

  const depth = easyMode ? EASY_MAX_DEPTH : MAX_DEPTH;
  let bestMove = null;
  const isWhite = state.turn === COLORS.WHITE;
  let bestValue = isWhite ? -Infinity : Infinity;

  for (const move of legalMoves) {
    const nextState = getNextState(state, move);
    const moveValue = minimax(nextState, depth - 1, -Infinity, Infinity, !isWhite);

    if (isWhite ? moveValue > bestValue : moveValue < bestValue) {
      bestValue = moveValue;
      bestMove = move;
    }
  }

  // Fallback if somehow nothing is better
  return bestMove || legalMoves[0];
}

self.onmessage = function(e) {
  const { type, state, easyMode } = e.data;
  if (type === 'search') {
    const bestMove = findBestMove(state, easyMode);
    self.postMessage({ type: 'bestMove', move: bestMove });
  }
};
