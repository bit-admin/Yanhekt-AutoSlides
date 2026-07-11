<template>
  <div class="app">
    <Header />
    <div class="layout">
      <!-- Backdrop for mobile sidebar drawer -->
      <div
        v-if="!isSidebarCollapsed && isMobile && !playbackStore.cinema.value"
        class="sidebar-backdrop"
        @click="toggleSidebar"
      ></div>

      <div
        class="left-panel-slot"
        :class="{ 'collapsed': isSidebarCollapsed }"
        v-show="!playbackStore.cinema.value"
      >
        <LeftPanel />
      </div>
      <div class="main-content-slot">
        <MainContent />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Header from './components/Header.vue'
import LeftPanel from './components/LeftPanel.vue'
import MainContent from './components/MainContent.vue'
import { playbackStore } from './stores/playbackStore'
import { navigationStore } from './stores/navigationStore'

const { isSidebarCollapsed, toggleSidebar } = navigationStore

const isMobile = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-page);
}

.layout {
  display: flex;
  flex: 1;
  height: calc(100vh - 56px);
  min-height: 0;
  position: relative;
}

.left-panel-slot {
  width: 240px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  background-color: var(--bg-page-alt);
  transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.left-panel-slot.collapsed {
  width: 72px;
}

.main-content-slot {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.sidebar-backdrop {
  position: fixed;
  top: 56px;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--overlay-dark);
  z-index: 98;
  backdrop-filter: blur(2px);
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 768px) {
  .left-panel-slot {
    position: fixed;
    top: 56px;
    left: 0;
    bottom: 0;
    z-index: 99;
    width: 240px;
    height: calc(100vh - 56px);
    box-shadow: 4px 0 10px var(--shadow-md);
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateX(0);
  }

  .left-panel-slot.collapsed {
    width: 240px; /* Keep full width but hide via transform */
    border-right: none;
    transform: translateX(-240px);
  }
}
</style>
