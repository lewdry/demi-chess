import { describe, it, expect } from 'vitest';
import { createInitialBoard, printBoard, algebraicToIndex, COLORS, EMPTY } from './board';
import { generatePseudoLegalMoves } from './moveGeneration';
import { getLegalMoves, simulateMove, isSquareAttacked, applyMoveToState, createInitialGameState } from './game';

describe('Board Representation', () => {
  it('creates the initial board correctly', () => {
    const board = createInitialBoard();
    
    expect(board[algebraicToIndex('a1')].type).toBe('k');
    expect(board[algebraicToIndex('a1')].color).toBe('w');
    expect(board[algebraicToIndex('d1')].type).toBe('r');
    expect(board[algebraicToIndex('a8')].type).toBe('k');
    expect(board[algebraicToIndex('d8')].type).toBe('r');
    
    expect(board[algebraicToIndex('a3')]).toBeNull();
  });
});

describe('Move Generation (Phase 1)', () => {
  it('generates the correct number of pseudo-legal moves from the start position for white', () => {
    const board = createInitialBoard();
    const moves = generatePseudoLegalMoves(board, COLORS.WHITE);
    expect(moves.length).toBe(10);
  });
});

describe('Legality and Game State (Phase 2)', () => {
  it('detects check and filters moves that leave king in check', () => {
    const board = createInitialBoard();
    // clear the path
    board[algebraicToIndex('b2')] = EMPTY;
    board[algebraicToIndex('c2')] = EMPTY;
    // put a black rook aiming at white king (now on b1 replacing bishop)
    board[algebraicToIndex('b1')] = { type: 'r', color: 'b' };
    
    const attackLegalMoves = getLegalMoves(board, COLORS.WHITE, false, null);
    const kingTakes = attackLegalMoves.find(m => m.from === algebraicToIndex('a1') && m.to === algebraicToIndex('b1'));
    expect(kingTakes).toBeDefined();
    
    // moving king to a2 should be illegal because rook at b1 attacks b2 (wait a2 is occupied by white pawn!)
    // so king can only take b1 or be blocked.
  });

  it('handles castling correctly', () => {
    const board = createInitialBoard();
    board[algebraicToIndex('b1')] = EMPTY;
    board[algebraicToIndex('c1')] = EMPTY;
    
    const moves = getLegalMoves(board, COLORS.WHITE, true, null);
    const castleMove = moves.find(m => m.flags === 'castle');
    expect(castleMove).toBeDefined();
    
    const nextBoard = simulateMove(board, castleMove);
    expect(nextBoard[algebraicToIndex('c1')].type).toBe('k');
    expect(nextBoard[algebraicToIndex('b1')].type).toBe('r');
  });
  
  it('applies pawn promotion', () => {
    const board = createInitialBoard();
    board[algebraicToIndex('a7')] = { type: 'p', color: 'w' };
    board[algebraicToIndex('a8')] = EMPTY;
    
    const nextBoard = simulateMove(board, { from: algebraicToIndex('a7'), to: algebraicToIndex('a8') });
    expect(nextBoard[algebraicToIndex('a8')].type).toBe('q');
  });

  it('performs en passant', () => {
    const board = createInitialBoard();
    board[algebraicToIndex('b5')] = { type: 'p', color: 'w' };
    board[algebraicToIndex('c5')] = { type: 'p', color: 'b' };
    
    const moves = getLegalMoves(board, COLORS.WHITE, false, algebraicToIndex('c6'));
    const epMove = moves.find(m => m.flags === 'ep');
    expect(epMove).toBeDefined();
    expect(epMove.to).toBe(algebraicToIndex('c6'));
    
    const nextBoard = simulateMove(board, epMove);
    expect(nextBoard[algebraicToIndex('c6')].type).toBe('p');
    expect(nextBoard[algebraicToIndex('c5')]).toBe(EMPTY);
  });
});

describe('Draw by repetition (Phase 3)', () => {
  it('allows claiming a draw at threefold repetition and forces one at fivefold', () => {
    let state = createInitialGameState();
    const whiteKnightHome = algebraicToIndex('c1');
    const blackKnightHome = algebraicToIndex('c8');

    const moveFrom = (color, fromSquare) =>
      getLegalMoves(state.board, color, state.castlingRights[color], state.enPassantTarget)
        .find(m => m.from === fromSquare);
    const moveBackTo = (color, fromSquare, toSquare) =>
      getLegalMoves(state.board, color, state.castlingRights[color], state.enPassantTarget)
        .find(m => m.from === fromSquare && m.to === toSquare);

    let claimableAtCycle = null;
    let drawAtCycle = null;

    for (let cycle = 0; cycle < 4 && drawAtCycle === null; cycle++) {
      const whiteOut = moveFrom(COLORS.WHITE, whiteKnightHome);
      state = applyMoveToState(state, whiteOut);
      const blackOut = moveFrom(COLORS.BLACK, blackKnightHome);
      state = applyMoveToState(state, blackOut);
      const whiteBack = moveBackTo(COLORS.WHITE, whiteOut.to, whiteKnightHome);
      state = applyMoveToState(state, whiteBack);
      const blackBack = moveBackTo(COLORS.BLACK, blackOut.to, blackKnightHome);
      state = applyMoveToState(state, blackBack);

      if (state.canClaimDraw && claimableAtCycle === null) claimableAtCycle = cycle;
      if (state.status === 'draw-repetition') drawAtCycle = cycle;
    }

    // The starting position recurs every full knight-shuffle cycle: it's the
    // 1st occurrence before any moves, so the 3rd occurrence lands after the
    // 2nd cycle (index 1), and the 5th occurrence after the 4th cycle (index 3).
    expect(claimableAtCycle).toBe(1);
    expect(drawAtCycle).toBe(3);
    expect(state.status).toBe('draw-repetition');
  });
});

