import { COLORS, EMPTY, PIECES } from './board.js';
import { generatePseudoLegalMoves } from './moveGeneration.js';

/**
 * Checks if a specific square is attacked by any piece of the given attacker color.
 * Used for checking if the king is in check, or if a castling path is threatened.
 */
export function isSquareAttacked(targetSquare, board, attackerColor) {
  // We can just generate all pseudo-legal moves for the attacker
  // and see if any land on targetSquare.
  const attackMoves = generatePseudoLegalMoves(board, attackerColor);
  for (const move of attackMoves) {
    if (move.to === targetSquare) {
      return true;
    }
  }
  return false;
}

/**
 * Filter pseudo-legal moves to only include those that don't leave the own king in check.
 * Also handles adding castling if legal.
 */
export function getLegalMoves(board, color, castlingRight, enPassantTarget) {
  const opponentColor = color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;
  
  // 1. Get standard pseudo-legal moves
  const pseudoMoves = generatePseudoLegalMoves(board, color, enPassantTarget);
  const legalMoves = [];

  // Find the king
  let kingSquare = -1;
  for (let i = 0; i < 32; i++) {
    if (board[i] && board[i].type === PIECES.KING && board[i].color === color) {
      kingSquare = i;
      break;
    }
  }

  // 2. Filter out moves that leave king in check
  for (const move of pseudoMoves) {
    const nextBoard = simulateMove(board, move);
    
    // Where is the king after the move? (in case the move was the king moving)
    const nextKingSquare = move.from === kingSquare ? move.to : kingSquare;
    
    // Check if the king is attacked on the next board
    if (!isSquareAttacked(nextKingSquare, nextBoard, opponentColor)) {
      legalMoves.push(move);
    }
  }

  // 3. Add castling
  if (castlingRight) {
    if (color === COLORS.WHITE) {
      // White castling: King starts at a1 (28), Rook at d1 (31)
      // Must not be in check
      if (kingSquare === 28 && !isSquareAttacked(28, board, COLORS.BLACK)) {
        // b1 (29) and c1 (30) must be empty
        if (board[29] === EMPTY && board[30] === EMPTY) {
          // Path to c1 cannot be under attack (King passes through b1, lands on c1)
          if (!isSquareAttacked(29, board, COLORS.BLACK) && !isSquareAttacked(30, board, COLORS.BLACK)) {
             legalMoves.push({ from: 28, to: 30, flags: 'castle' });
          }
        }
      }
    } else {
      // Black castling: King starts at a8 (0), Rook at d8 (3)
      if (kingSquare === 0 && !isSquareAttacked(0, board, COLORS.WHITE)) {
        // b8 (1) and c8 (2) must be empty
        if (board[1] === EMPTY && board[2] === EMPTY) {
          if (!isSquareAttacked(1, board, COLORS.WHITE) && !isSquareAttacked(2, board, COLORS.WHITE)) {
             legalMoves.push({ from: 0, to: 2, flags: 'castle' });
          }
        }
      }
    }
  }

  return legalMoves;
}

/**
 * Applies a move to a board and returns a NEW board array.
 * Handles normal moves, en passant, castling, and auto-promotion.
 */
export function simulateMove(board, move) {
  const nextBoard = [...board];
  const piece = nextBoard[move.from];
  
  // Clear 'from'
  nextBoard[move.from] = EMPTY;

  // En passant capture
  if (move.flags === 'ep') {
    // The captured pawn is horizontally adjacent to the from square,
    // or you can derive it from the 'to' square (up or down 4)
    const capturedPawnIndex = piece.color === COLORS.WHITE ? move.to + 4 : move.to - 4;
    nextBoard[capturedPawnIndex] = EMPTY;
  }

  // Castling
  if (move.flags === 'castle') {
    // We already moved the king initially via nextBoard[move.to] = piece below
    // We just need to move the rook.
    if (piece.color === COLORS.WHITE) {
       // King 28 -> 30. Rook 31 -> 29.
       nextBoard[29] = nextBoard[31];
       nextBoard[31] = EMPTY;
    } else {
       // King 0 -> 2. Rook 3 -> 1.
       nextBoard[1] = nextBoard[3];
       nextBoard[3] = EMPTY;
    }
  }

  // Place piece
  nextBoard[move.to] = piece;

  // Auto-promotion
  if (piece.type === PIECES.PAWN) {
    const targetRow = Math.floor(move.to / 4);
    if ((piece.color === COLORS.WHITE && targetRow === 0) || 
        (piece.color === COLORS.BLACK && targetRow === 7)) {
      nextBoard[move.to] = { type: PIECES.QUEEN, color: piece.color };
    }
  }

  return nextBoard;
}

/**
 * Applies a move and produces the updated full game state.
 */
export function applyMoveToState(state, move) {
  const piece = state.board[move.from];
  const nextBoard = simulateMove(state.board, move);
  
  // Calculate new castling rights
  const newCastlingRights = { ...state.castlingRights };
  if (piece.type === PIECES.KING) {
    newCastlingRights[piece.color] = false;
  } else if (piece.type === PIECES.ROOK) {
    // In Demi-chess, if the rook moves or is captured, we lose castling.
    // White rook starts at d1 (31)
    if (move.from === 31 && piece.color === COLORS.WHITE) newCastlingRights.w = false;
    // Black rook starts at d8 (3)
    if (move.from === 3 && piece.color === COLORS.BLACK) newCastlingRights.b = false;
  }
  
  // If a rook is captured on its home square, the owner loses castling rights
  if (move.to === 31) newCastlingRights.w = false;
  if (move.to === 3) newCastlingRights.b = false;

  // En passant target (double pawn push)
  let newEpTarget = null;
  if (piece.type === PIECES.PAWN) {
    const rowDiff = Math.abs(Math.floor(move.to / 4) - Math.floor(move.from / 4));
    if (rowDiff === 2) {
      newEpTarget = piece.color === COLORS.WHITE ? move.from - 4 : move.from + 4;
    }
  }

  // Opponent turn
  const nextColor = state.turn === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE;

  // Determine game status
  const nextLegalMoves = getLegalMoves(
    nextBoard, 
    nextColor, 
    newCastlingRights[nextColor], 
    newEpTarget
  );
  
  // Find King for next player
  let nextKingSquare = -1;
  for (let i = 0; i < 32; i++) {
    if (nextBoard[i] && nextBoard[i].type === PIECES.KING && nextBoard[i].color === nextColor) {
      nextKingSquare = i;
      break;
    }
  }
  
  const inCheck = isSquareAttacked(nextKingSquare, nextBoard, piece.color);
  let status = 'playing';
  
  if (nextLegalMoves.length === 0) {
    status = inCheck ? 'checkmate' : 'stalemate';
  } else if (inCheck) {
    status = 'check';
  }
  
  // Record history
  const historyEntry = {
    piece,
    from: move.from,
    to: move.to,
    captured: state.board[move.to] || (move.flags === 'ep' ? { type: PIECES.PAWN, color: nextColor } : null),
    flags: move.flags
  };

  return {
    board: nextBoard,
    turn: nextColor,
    castlingRights: newCastlingRights,
    enPassantTarget: newEpTarget,
    history: [...state.history, historyEntry],
    status,
    legalMovesOfTurn: nextLegalMoves
  };
}
