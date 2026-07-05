import { COLORS, PIECES, EMPTY } from './board.js';

// Offsets for sliding pieces based on 4-wide board
// Up/Down: -4/+4
// Left/Right: -1/+1
// Diagonals: -5, -3, +3, +5
const DIRECTION_OFFSETS = {
  UP: -4,
  DOWN: 4,
  LEFT: -1,
  RIGHT: 1,
  UP_LEFT: -5,
  UP_RIGHT: -3,
  DOWN_LEFT: 3,
  DOWN_RIGHT: 5,
};

const KNIGHT_OFFSETS = [
  -9, -7, // UP 2, LEFT/RIGHT 1 (-8 -1, -8 +1)
  -6, -2, // UP 1, LEFT/RIGHT 2 (-4 -2, -4 +2)
  2, 6,   // DOWN 1, LEFT/RIGHT 2 (+4 -2, +4 +2)
  7, 9    // DOWN 2, LEFT/RIGHT 1 (+8 -1, +8 +1)
];

// Helper to check if a square is within board bounds and wrap hasn't occurred incorrectly
function isValidPos(index) {
  return index >= 0 && index < 32;
}

// Pseudo-legal moves (doesn't check if king is left in check)
export function generatePseudoLegalMoves(board, color, enPassantTarget = null) {
  const moves = [];

  for (let i = 0; i < 32; i++) {
    const piece = board[i];
    if (piece && piece.color === color) {
      if (piece.type === PIECES.PAWN) {
        generatePawnMoves(i, board, color, moves, enPassantTarget);
      } else if (piece.type === PIECES.KNIGHT) {
        generateKnightMoves(i, board, color, moves);
      } else if (piece.type === PIECES.BISHOP) {
        generateSlidingMoves(i, board, color, moves, [DIRECTION_OFFSETS.UP_LEFT, DIRECTION_OFFSETS.UP_RIGHT, DIRECTION_OFFSETS.DOWN_LEFT, DIRECTION_OFFSETS.DOWN_RIGHT]);
      } else if (piece.type === PIECES.ROOK) {
        generateSlidingMoves(i, board, color, moves, [DIRECTION_OFFSETS.UP, DIRECTION_OFFSETS.DOWN, DIRECTION_OFFSETS.LEFT, DIRECTION_OFFSETS.RIGHT]);
      } else if (piece.type === PIECES.QUEEN) {
        generateSlidingMoves(i, board, color, moves, Object.values(DIRECTION_OFFSETS));
      } else if (piece.type === PIECES.KING) {
        generateKingMoves(i, board, color, moves);
      }
    }
  }

  return moves;
}

function generatePawnMoves(startSquare, board, color, moves, enPassantTarget) {
  const direction = color === COLORS.WHITE ? DIRECTION_OFFSETS.UP : DIRECTION_OFFSETS.DOWN;
  const startRank = color === COLORS.WHITE ? 6 : 1; // row 6 for white pawns, row 1 for black
  
  // Forward one
  const forwardOne = startSquare + direction;
  if (isValidPos(forwardOne) && board[forwardOne] === EMPTY) {
    moves.push({ from: startSquare, to: forwardOne });
    
    // Forward two (only from starting rank, if forward one is empty)
    const currentRow = Math.floor(startSquare / 4);
    if (currentRow === startRank) {
      const forwardTwo = forwardOne + direction;
      if (isValidPos(forwardTwo) && board[forwardTwo] === EMPTY) {
        moves.push({ from: startSquare, to: forwardTwo });
      }
    }
  }

  // Captures
  const captureOffsets = color === COLORS.WHITE 
    ? [DIRECTION_OFFSETS.UP_LEFT, DIRECTION_OFFSETS.UP_RIGHT] 
    : [DIRECTION_OFFSETS.DOWN_LEFT, DIRECTION_OFFSETS.DOWN_RIGHT];

  const startCol = startSquare % 4;
  for (const offset of captureOffsets) {
    const target = startSquare + offset;
    if (isValidPos(target)) {
      const targetCol = target % 4;
      // Ensure we didn't wrap around the board completely (column diff should be 1)
      if (Math.abs(startCol - targetCol) === 1) {
        if (board[target] && board[target].color !== color) {
          moves.push({ from: startSquare, to: target });
        } else if (target === enPassantTarget) {
          moves.push({ from: startSquare, to: target, flags: 'ep' });
        }
      }
    }
  }
}

function generateKnightMoves(startSquare, board, color, moves) {
  const startCol = startSquare % 4;
  const startRow = Math.floor(startSquare / 4);

  for (const offset of KNIGHT_OFFSETS) {
    const target = startSquare + offset;
    if (isValidPos(target)) {
      const targetCol = target % 4;
      const targetRow = Math.floor(target / 4);
      
      // Knight move must change col by 1 and row by 2, OR col by 2 and row by 1
      const colDiff = Math.abs(startCol - targetCol);
      const rowDiff = Math.abs(startRow - targetRow);
      
      if ((colDiff === 1 && rowDiff === 2) || (colDiff === 2 && rowDiff === 1)) {
        if (!board[target] || board[target].color !== color) {
          moves.push({ from: startSquare, to: target });
        }
      }
    }
  }
}

function generateKingMoves(startSquare, board, color, moves) {
  const startCol = startSquare % 4;
  
  for (const offset of Object.values(DIRECTION_OFFSETS)) {
    const target = startSquare + offset;
    if (isValidPos(target)) {
      const targetCol = target % 4;
      // King moves a max of 1 square in column
      if (Math.abs(startCol - targetCol) <= 1) {
        if (!board[target] || board[target].color !== color) {
          moves.push({ from: startSquare, to: target });
        }
      }
    }
  }
}

function generateSlidingMoves(startSquare, board, color, moves, offsets) {
  const startCol = startSquare % 4;

  for (const offset of offsets) {
    let currentSquare = startSquare;
    let currentCol = startCol;

    while (true) {
      currentSquare += offset;
      
      if (!isValidPos(currentSquare)) break;
      
      const newCol = currentSquare % 4;
      // Ensure we didn't wrap incorrectly (moving one step should change column by at most 1)
      if (Math.abs(currentCol - newCol) > 1) break;

      currentCol = newCol;

      if (board[currentSquare] === EMPTY) {
        moves.push({ from: startSquare, to: currentSquare });
      } else {
        // Hit a piece
        if (board[currentSquare].color !== color) {
          moves.push({ from: startSquare, to: currentSquare });
        }
        break; // Stop sliding
      }
    }
  }
}
