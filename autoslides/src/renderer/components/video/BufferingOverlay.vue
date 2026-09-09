<template>
  <div class="buffering-overlay">
    <div class="buffering-ring"></div>
  </div>
</template>

<script setup lang="ts">
/**
 * The one buffering indicator, shared by every player in the app: the playback
 * page (single and dual) and the Lectures workspace player.
 *
 * Deliberately wordless — a stall is self-explanatory, and a labelled pill would
 * compete with the retry indicator, which does have something to say. The caller
 * owns the condition (`v-if`); pair it with `useBufferingIndicator`, which
 * debounces the HLS `waiting` chatter so this cannot strobe.
 */
</script>

<style scoped>
.buffering-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: var(--z-player-overlay);
}

/* White on translucent white, so it reads over a bright slide and a dark
   lecture hall alike — video is not themed, so this does not follow the tokens. */
.buffering-ring {
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.25);
  border-top-color: #fff;
  border-radius: 50%;
  animation: buffering-spin 0.8s linear infinite;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45));
}

@keyframes buffering-spin {
  to { transform: rotate(360deg); }
}
</style>
