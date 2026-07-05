export const COLORS = {
  WHITE: 'w',
  BLACK: 'b'
};

export const PIECES = {
  KING: 'k',
  QUEEN: 'q',
  ROOK: 'r',
  BISHOP: 'b',
  KNIGHT: 'n',
  PAWN: 'p'
};

// Represents an empty square
export const EMPTY = null;

/**
 * Creates the initial board state for Demi-chess.
 * Board is 4x8 (32 squares).
 * Index = row * 4 + col.
 * Row 0 is rank 8 (Black's back rank)
 * Row 1 is rank 7 (Black pawns)
 * ...
 * Row 6 is rank 2 (White pawns)
 * Row 7 is rank 1 (White's back rank)
 */
export function createInitialBoard() {
  const board = new Array(32).fill(EMPTY);

  // Black back rank (Row 0: rank 8)
  board[0] = { type: PIECES.KING, color: COLORS.BLACK };   // a8
  board[1] = { type: PIECES.BISHOP, color: COLORS.BLACK }; // b8
  board[2] = { type: PIECES.KNIGHT, color: COLORS.BLACK }; // c8
  board[3] = { type: PIECES.ROOK, color: COLORS.BLACK };   // d8

  // Black pawns (Row 1: rank 7)
  for (let c = 0; c < 4; c++) {
    board[1 * 4 + c] = { type: PIECES.PAWN, color: COLORS.BLACK };
  }

  // White pawns (Row 6: rank 2)
  for (let c = 0; c < 4; c++) {
    board[6 * 4 + c] = { type: PIECES.PAWN, color: COLORS.WHITE };
  }

  // White back rank (Row 7: rank 1)
  board[28] = { type: PIECES.KING, color: COLORS.WHITE };   // a1
  board[29] = { type: PIECES.BISHOP, color: COLORS.WHITE }; // b1
  board[30] = { type: PIECES.KNIGHT, color: COLORS.WHITE }; // c1
  board[31] = { type: PIECES.ROOK, color: COLORS.WHITE };   // d1

  return board;
}

/**
 * Convert index to algebraic notation (e.g., 28 -> 'a1')
 */
export function indexToAlgebraic(index) {
  if (index < 0 || index > 31) return null;
  const row = Math.floor(index / 4);
  const col = index % 4;
  const file = String.fromCharCode('a'.charCodeAt(0) + col);
  const rank = 8 - row;
  return `${file}${rank}`;
}

/**
 * Convert algebraic notation to index (e.g., 'a1' -> 28)
 */
export function algebraicToIndex(algebraic) {
  if (algebraic.length !== 2) return null;
  const col = algebraic.charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(algebraic[1], 10);
  if (col < 0 || col > 3 || isNaN(rank) || rank < 1 || rank > 8) return null;
  const row = 8 - rank;
  return row * 4 + col;
}

export const PIECE_SYMBOLS = {
  'w': { 'k': '♔', 'q': '♕', 'r': '♖', 'b': '♗', 'n': '♘', 'p': '♙' },
  'b': { 'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟' }
};

/**
 * Print board to console for debugging
 */
export function printBoard(board) {

  let out = '\n';
  for (let r = 0; r < 8; r++) {
    out += `${8 - r} `;
    for (let c = 0; c < 4; c++) {
      const piece = board[r * 4 + c];
      if (piece === EMPTY) {
        out += '. ';
      } else {
        out += PIECE_SYMBOLS[piece.color][piece.type] + ' ';
      }
    }
    out += '\n';
  }
  out += '  a b c d\n';
  return out;
}
