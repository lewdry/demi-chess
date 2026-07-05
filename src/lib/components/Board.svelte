<script>
  import Piece from './Piece.svelte';
  import { COLORS, indexToAlgebraic } from '../engine/board.js';

  let { 
    boardState, 
    selectedSquare = null, 
    legalMoves = [], 
    onSquareClick,
    hiddenSquares = new Set(),
    animatingPieces = [],
    dark = false,
    gameOverMessage = null,
    gameOverVariant = 'neutral'
  } = $props();

  // Helper to check if a square is a legal move destination
  function isLegalMoveTarget(index) {
    return legalMoves.some(m => m.to === index);
  }

  // Pre-calculate valid target indices for fast rendering
  let targetIndices = $derived(new Set(legalMoves.map(m => m.to)));

</script>

<div class="mx-auto select-none w-full h-full flex justify-center items-center">
  <!-- 
    A grid 4 columns wide, 8 rows high. 
    Aspect ratio of total board is width/height = 4/8 = 1/2.
  -->
  <div 
    class="grid grid-cols-4 grid-rows-8 border-4 border-base-200 shadow-xl overflow-hidden h-full max-w-full relative transition-[filter] duration-300 {gameOverMessage ? 'grayscale' : ''}"
    style="aspect-ratio: 4/8;"
  >
    {#each boardState as piece, index}
      {@const row = Math.floor(index / 4)}
      {@const col = index % 4}
      {@const isLightSquare = (row + col) % 2 === 0}
      {@const isSelected = selectedSquare === index}
      {@const isTarget = targetIndices.has(index)}
      <!--
        Square coloring: 
        We use base-200 / base-300 for neutral look.
      -->
      <button 
        class="
          relative w-full h-full flex items-center justify-center cursor-pointer transition-colors duration-200 p-0 m-0 border-none
          {isLightSquare ? (dark ? 'bg-[#4a4a4a]' : 'bg-[#d1bfae]') : (dark ? 'bg-[#333333]' : 'bg-[#a68a73]')}
          {isSelected ? 'ring-inset ring-4 ring-primary/80 z-10' : ''}
          hover:opacity-90 focus:outline-none
        "
        onclick={() => onSquareClick(index)}
        aria-label="Square {indexToAlgebraic(index)}"
      >
        {#if piece && !hiddenSquares.has(index)}
          <div class="w-full h-full relative z-0">
            <Piece {piece} />
          </div>
        {/if}

        {#if isTarget}
          <div class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
            {#if piece}
              <!-- Capture hint: ring around piece -->
              <div class="w-[85%] h-[85%] border-[6px] border-primary/40 rounded-none"></div>
            {:else}
              <!-- Move hint: dot in empty square -->
              <div class="w-[25%] h-[25%] bg-primary/40 rounded-none"></div>
            {/if}
          </div>
        {/if}
        
      </button>
    {/each}

    <!-- Animation overlay: pieces mid-move are rendered here, sliding from their
         origin to their destination square while the underlying board still
         reflects the pre-move position. -->
    {#each animatingPieces as ap (ap.piece)}
      <div
        class="absolute z-30 pointer-events-none"
        style="width: 25%; height: 12.5%; top: {ap.row * 12.5}%; left: {ap.col * 25}%; transition: top 300ms ease-in-out, left 300ms ease-in-out;"
      >
        <Piece piece={ap.piece} />
      </div>
    {/each}

    <!-- Game over overlay: dims the board and surfaces the terminal status
         (checkmate/stalemate/draw) front and center. -->
    {#if gameOverMessage}
      <div class="absolute inset-0 z-40 bg-base-content/30 flex items-center justify-center pointer-events-none px-4">
        <span
          class="
            badge badge-lg md:text-lg font-bold tracking-wide px-4 py-4 shadow-xl text-center whitespace-normal h-auto
            {gameOverVariant === 'error' ? 'badge-error' : 'badge-neutral'}
          "
        >
          {gameOverMessage}
        </span>
      </div>
    {/if}
  </div>
</div>