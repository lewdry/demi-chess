<script>
  import Board from './lib/components/Board.svelte';
  import { COLORS, indexToAlgebraic, EMPTY, PIECE_SYMBOLS } from './lib/engine/board.js';
  import { getLegalMoves, applyMoveToState, createInitialGameState } from './lib/engine/game.js';
  import { onMount } from 'svelte';

  let dark = $state(false);
  let vsComputer = $state(true);
  let easyMode = $state(false);

  function handleThemeChange(e) {
    dark = e.target.checked;
    localStorage.setItem('theme', dark ? 'forest' : 'caramellatte');
  }

  function setVsComputer(value) {
    if (vsComputer === value) return;
    vsComputer = value;
    localStorage.setItem('vsComputer', value ? '1' : '0');
    aiThinking = false;
  }

  function handleEasyModeChange(e) {
    easyMode = e.target.checked;
    localStorage.setItem('easyMode', easyMode ? '1' : '0');
  }

  // 'check' is not a terminal state — the game keeps going, only
  // 'checkmate', 'stalemate', and the draw statuses actually end it.
  function isGameActive(status) {
    return status === 'playing' || status === 'check';
  }

  // Centered board-overlay text/color shown once the game has ended. On
  // checkmate, `gameState.turn` is the side with no legal moves (the loser),
  // so the winner is whoever just moved.
  let gameOverMessage = $derived.by(() => {
    switch (gameState.status) {
      case 'checkmate':
        return gameState.turn === COLORS.WHITE ? 'Black Wins' : 'White Wins';
      case 'stalemate':
        return 'Stalemate';
      case 'draw-repetition':
        return 'Draw · Repetition';
      case 'draw-claimed':
        return 'Draw · Claimed';
      default:
        return null;
    }
  });
  let gameOverVariant = $derived(gameState.status === 'checkmate' ? 'error' : 'neutral');

  let worker = null;

  // Timing for the AI's move: a short "thinking" pause followed by a slide animation,
  // so black's reply never feels instantaneous.
  const AI_THINK_MS = 650;
  const MOVE_ANIM_MS = 300;

  let gameId = 0;
  let isAnimating = $state(false);
  let aiThinking = $state(false);
  let animatingPieces = $state([]);
  let hiddenSquares = $state(new Set());

  onMount(() => {
    worker = new Worker(new URL('./lib/workers/engine.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      if (e.data.type === 'bestMove' && e.data.move) {
        const requestedGameId = gameId;
        const move = e.data.move;
        setTimeout(() => {
          if (gameId !== requestedGameId || !vsComputer) return;
          aiThinking = false;
          performMove(move, gameState);
        }, AI_THINK_MS);
      }
    };

    // Match whatever theme index.html already resolved pre-paint (stored
    // preference, or the OS preference if the user hasn't chosen one yet).
    const storedTheme = localStorage.getItem('theme');
    const darkMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    dark = storedTheme ? storedTheme === 'forest' : darkMediaQuery.matches;

    const storedVsComputer = localStorage.getItem('vsComputer');
    if (storedVsComputer !== null) vsComputer = storedVsComputer === '1';

    const storedEasyMode = localStorage.getItem('easyMode');
    if (storedEasyMode !== null) easyMode = storedEasyMode === '1';

    // If the user hasn't made an explicit choice, keep following the OS setting live.
    const handleSystemThemeChange = (e) => {
      if (!localStorage.getItem('theme')) {
        dark = e.matches;
      }
    };
    darkMediaQuery.addEventListener('change', handleSystemThemeChange);

    return () => {
      worker && worker.terminate();
      darkMediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  });

  // Initial State 
  let gameState = $state(createInitialGameState());

  // Animates a move (and, for castling, the accompanying rook) sliding from its
  // origin to its destination, then commits the resulting game state.
  function performMove(move, fromState) {
    const requestedGameId = gameId;
    isAnimating = true;

    const piece = fromState.board[move.from];
    const pieces = [{
      piece,
      row: Math.floor(move.from / 4),
      col: move.from % 4,
      toRow: Math.floor(move.to / 4),
      toCol: move.to % 4
    }];

    if (move.flags === 'castle') {
      const isWhite = piece.color === COLORS.WHITE;
      const rookFrom = isWhite ? 31 : 3;
      const rookTo = isWhite ? 29 : 1;
      pieces.push({
        piece: fromState.board[rookFrom],
        row: Math.floor(rookFrom / 4),
        col: rookFrom % 4,
        toRow: Math.floor(rookTo / 4),
        toCol: rookTo % 4
      });
    }

    hiddenSquares = new Set([move.from, ...(move.flags === 'castle' ? [piece.color === COLORS.WHITE ? 31 : 3] : [])]);
    animatingPieces = pieces;

    // Wait a frame so the start position paints before we move to the end
    // position, otherwise the CSS transition has nothing to animate from.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (gameId !== requestedGameId) return;
        animatingPieces = animatingPieces.map(p => ({ ...p, row: p.toRow, col: p.toCol }));
      });
    });

    setTimeout(() => {
      if (gameId !== requestedGameId) return;
      gameState = applyMoveToState(fromState, move);
      animatingPieces = [];
      hiddenSquares = new Set();
      isAnimating = false;
    }, MOVE_ANIM_MS);
  }

  // Derived state to avoid recalculating unnecessarily
  $effect(() => {
    if (isGameActive(gameState.status) && gameState.legalMovesOfTurn.length === 0 && gameState.history.length === 0) {
      // Very first turn initial load
      gameState.legalMovesOfTurn = getLegalMoves(
        gameState.board, 
        gameState.turn, 
        gameState.castlingRights[gameState.turn], 
        gameState.enPassantTarget
      );
    }
  });

  $effect(() => {
    // If it's black's turn and the game is playing, tell the worker to search
    if (vsComputer && gameState.turn === COLORS.BLACK && isGameActive(gameState.status) && worker) {
      aiThinking = true;
      worker.postMessage({ type: 'search', state: $state.snapshot(gameState), easyMode });
    }
  });

  let selectedSquare = $state(null);
  // Legal moves for the CURRENTLY SELECTED piece
  let currentLegalMoves = $derived(
    selectedSquare !== null 
      ? gameState.legalMovesOfTurn.filter(m => m.from === selectedSquare)
      : []
  );

  function onSquareClick(index) {
    if (!isGameActive(gameState.status) || isAnimating) return;

    if (selectedSquare === null) {
      // Select a piece if it belongs to the current player
      const piece = gameState.board[index];
      if (piece && piece.color === gameState.turn) {
        selectedSquare = index;
      }
    } else {
      // If clicking the same square, deselect
      if (selectedSquare === index) {
        selectedSquare = null;
        return;
      }

      // Check if clicked square is a legal move destination
      const move = currentLegalMoves.find(m => m.to === index);
      if (move) {
        // Execute move
        performMove(move, gameState);
        selectedSquare = null;
      } else {
        // Did they click another of their own pieces? Switch selection.
        const piece = gameState.board[index];
        if (piece && piece.color === gameState.turn) {
          selectedSquare = index;
        } else {
          // Clicked empty space or opponent piece but not a legal move -> deselect
          selectedSquare = null;
        }
      }
    }
  }

  function startNewGame() {
    gameId++;
    isAnimating = false;
    aiThinking = false;
    animatingPieces = [];
    hiddenSquares = new Set();
    gameState = createInitialGameState();
    selectedSquare = null;
  }

  // Lets the side to move claim a draw once the current position has
  // occurred three times (fivefold repetition ends the game automatically).
  function claimDraw() {
    if (!gameState.canClaimDraw || !isGameActive(gameState.status) || isAnimating) return;
    gameState = { ...gameState, status: 'draw-claimed', canClaimDraw: false };
  }
</script>

<div class="min-h-dvh w-full md:h-screen bg-base-100 text-base-content flex flex-col-reverse md:flex-row items-stretch justify-center p-4 md:p-8 gap-6 md:gap-8 md:overflow-hidden">
  <!-- Sidebar -->
  <div class="w-full md:w-96 flex flex-col gap-6 shrink md:shrink-0 min-h-0 bg-base-200 p-6 rounded-none shadow-sm md:overflow-y-auto md:max-h-full">
    <div class="flex justify-between items-start shrink-0">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Demi-Chess</h1>
        <p class="text-sm opacity-70 mt-1">A simple chess variant</p>
      </div>
      <label class="cursor-pointer p-2 mt-1 opacity-70 hover:opacity-100 transition-opacity">
        <!-- Sun icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 swap-off fill-current" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class:hidden={dark}><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
        <!-- Moon icon -->
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 swap-on fill-current" viewBox="0 0 20 20" class:hidden={!dark}><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" /></svg>
        <input
          type="checkbox"
          class="theme-controller hidden"
          value="forest"
          checked={dark}
          onchange={handleThemeChange}
        />
        <span class="sr-only">Toggle dark mode</span>
      </label>
    </div>

    <!-- STATUS -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-3">
        <span class="text-lg font-medium capitalize">{gameState.turn === 'w' ? "White's" : "Black's"} Turn</span>
        {#if aiThinking}
          <span class="badge badge-ghost animate-pulse">Thinking…</span>
        {:else if gameState.status === 'check'}
          <span class="badge badge-warning">Check</span>
        {:else if gameState.status === 'checkmate'}
          <span class="badge badge-error">Checkmate</span>
        {:else if gameState.status === 'stalemate'}
          <span class="badge badge-neutral">Stalemate</span>
        {:else if gameState.status === 'draw-repetition'}
          <span class="badge badge-neutral">Draw · Repetition</span>
        {:else if gameState.status === 'draw-claimed'}
          <span class="badge badge-neutral">Draw · Claimed</span>
        {/if}
      </div>
      {#if gameState.canClaimDraw && isGameActive(gameState.status)}
        <button type="button" class="btn btn-sm btn-outline w-fit" onclick={claimDraw}>
          Claim Draw (3-fold repetition)
        </button>
      {/if}
      {#if vsComputer}
        <label class="flex items-center gap-2 cursor-pointer w-fit text-sm">
          <input
            type="checkbox"
            class="checkbox checkbox-sm"
            checked={easyMode}
            onchange={handleEasyModeChange}
          />
          Take it easy
        </label>
      {/if}
    </div>

    <!-- HISTORY -->
    <div class="flex flex-col gap-2 md:flex-grow overflow-hidden shrink min-h-0 max-h-56 md:max-h-none">
      <h2 class="text-xs font-bold tracking-widest opacity-50 uppercase">History</h2>
      <div class="bg-base-100 rounded-none p-3 flex-1 overflow-y-auto font-mono text-sm shadow-inner min-h-0">
        {#if gameState.history.length === 0}
          <div class="opacity-50 italic text-center py-4">No moves yet</div>
        {:else}
          <div class="flex flex-col gap-1">
            {#each Array(Math.ceil(gameState.history.length / 2)) as _, turnIndex}
              {@const m1 = gameState.history[turnIndex * 2]}
              {@const m2 = gameState.history[turnIndex * 2 + 1]}
              <div class="flex gap-2">
                <span class="opacity-50 w-6 text-right">{turnIndex + 1}.</span>
                <span class="w-20 whitespace-nowrap">{PIECE_SYMBOLS[m1.piece.color][m1.piece.type]} {indexToAlgebraic(m1.from)}→{indexToAlgebraic(m1.to)}</span>
                {#if m2}
                  <span class="w-20 whitespace-nowrap">{PIECE_SYMBOLS[m2.piece.color][m2.piece.type]} {indexToAlgebraic(m2.from)}→{indexToAlgebraic(m2.to)}</span>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- RULES -->
    <div class="collapse collapse-arrow bg-base-100 shadow-sm border border-base-300 shrink-0">
      <input type="checkbox" /> 
      <div class="collapse-title font-medium text-sm">
        What is Demi-Chess?
      </div>
      <div class="collapse-content text-sm opacity-80 grid gap-2">
        <p>Demi-Chess was invented in 1986 by Peter Krystufek as a simple chess variant.</p>
        <p>• Half the board, half the pieces.</p>
        <p>• No Queens, unless pawns are promoted.</p>
        <p>• Check, checkmate, stalemate and en passant work normally.</p>
      </div>
    </div>

    <!-- MODE TOGGLE -->
    <div class="join w-full shrink-0">
      <button
        type="button"
        class="btn join-item flex-1 {vsComputer ? 'btn-secondary' : 'btn-ghost'}"
        aria-pressed={vsComputer}
        onclick={() => setVsComputer(true)}
      >
        1 Player
      </button>
      <button
        type="button"
        class="btn join-item flex-1 {!vsComputer ? 'btn-secondary' : 'btn-ghost'}"
        aria-pressed={!vsComputer}
        onclick={() => setVsComputer(false)}
      >
        2 Player
      </button>
    </div>

    <button class="btn btn-accent w-full mt-2" onclick={startNewGame}>
      New Game
    </button>

    <footer class="text-xs opacity-50 text-left italic shrink-0">
      By <a href="https://lewisdryburgh.com" target="_blank" rel="noopener noreferrer" class="link link-hover">Lewis Dryburgh</a>
    </footer>
  </div>

  <!-- Board Area -->
  <div class="w-full md:flex-1 flex items-center justify-center bg-base-300 rounded-none p-4 md:p-8 shadow-inner h-[80dvh] md:h-full overflow-hidden">
    <Board 
      boardState={gameState.board}
      selectedSquare={selectedSquare}
      legalMoves={currentLegalMoves}
      onSquareClick={onSquareClick}
      hiddenSquares={hiddenSquares}
      animatingPieces={animatingPieces}
      dark={dark}
      gameOverMessage={gameOverMessage}
      gameOverVariant={gameOverVariant}
    />
  </div>
</div>
