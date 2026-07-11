<template>
  <div class="app">
    <div class="layout">
      <div class="left-panel-slot" v-show="!playbackStore.cinema.value">
        <LeftPanel />
      </div>
      <div class="main-content-slot">
        <MainContent />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LeftPanel from './components/LeftPanel.vue'
import MainContent from './components/MainContent.vue'
import { playbackStore } from './stores/playbackStore'
</script>

<style scoped>
.app {
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-page);
}

.layout {
  display: flex;
  height: 100%;
}

.left-panel-slot {
  width: 255px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background-color: var(--bg-page-alt);
}

.main-content-slot {
  flex: 1;
  min-width: 0;
}

@media (max-width: 700px) {
  .left-panel-slot {
    width: 210px;
  }
}
</style>
