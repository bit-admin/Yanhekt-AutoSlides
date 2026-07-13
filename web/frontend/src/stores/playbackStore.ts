import { ref } from "vue";

// Playback identity lives in the route (/player/...); the only cross-cutting
// playback state left is cinema mode, which hides the sidebar so the player
// fills the window (App.vue reads it, PlayerRoute resets it on leave).
const cinema = ref(false);

export const playbackStore = { cinema };
