<script>
  import { PIECES, COLORS } from '../engine/board.js';
  
  let { piece, class: className = '' } = $props();

  let pieceType = $derived(piece?.type.toUpperCase());
  let pieceFile = $derived(piece ? `${piece.color}${pieceType}.svg` : null);
</script>

{#if pieceFile}
  <div class="w-full h-full p-[10%] drop-shadow-sm flex items-center justify-center">
    <img src="/pieces/{pieceFile}" alt="{piece.color} {piece.type}" class="w-full h-full object-contain pointer-events-none {className}" />
  </div>
{/if}