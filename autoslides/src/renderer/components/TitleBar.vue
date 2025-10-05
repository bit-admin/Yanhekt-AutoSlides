<template>
  <div class="titlebar" :class="{ 'is-macos': isMacOS }">
    <!-- macOS traffic lights space -->
    <div v-if="isMacOS" class="traffic-lights-space"></div>

    <!-- App title and drag area -->
    <div class="titlebar-drag-region">
      <!-- VS Code style search box -->
      <button class="search-box" @click="handleSearchClick">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14">
          <path d="M6.5 1a5.5 5.5 0 0 1 4.383 8.823l2.647 2.647a.75.75 0 1 1-1.06 1.06l-2.647-2.647A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor"/>
        </svg>
        <span class="search-text">AutoSlides</span>
      </button>
    </div>

    <!-- Window controls for non-macOS -->
    <div v-if="!isMacOS" class="window-controls">
      <button class="control-button minimize" @click="minimizeWindow" title="Minimize">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5" width="8" height="2" fill="currentColor"/>
        </svg>
      </button>
      <button class="control-button maximize" @click="maximizeWindow" title="Maximize">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
      </button>
      <button class="control-button close" @click="closeWindow" title="Close">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const isMacOS = ref(false);

onMounted(() => {
  // Detect platform using userAgent as navigator.platform is deprecated
  isMacOS.value = navigator.userAgent.toLowerCase().includes('mac');
});

// Search box click handler
const handleSearchClick = () => {
  // Placeholder for future search functionality
  console.log('Search box clicked');
};

// Window control functions for non-macOS platforms
const minimizeWindow = () => {
  // This would need IPC implementation for actual window control
  console.log('Minimize window');
};

const maximizeWindow = () => {
  // This would need IPC implementation for actual window control
  console.log('Maximize window');
};

const closeWindow = () => {
  // This would need IPC implementation for actual window control
  console.log('Close window');
};
</script>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  height: 36px;
  background: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  user-select: none;
  position: relative;
  z-index: 1000;
}

.titlebar.is-macos {
  height: 36px;
  background: #ffffff;
  border-bottom: 1px solid #d0d0d0;
}

/* macOS traffic lights space - reserve space for red/yellow/green buttons */
.traffic-lights-space {
  width: 78px; /* Standard macOS traffic lights width */
  height: 100%;
  flex-shrink: 0;
}

/* Drag region - allows window dragging */
.titlebar-drag-region {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: drag; /* Enable dragging */
  cursor: grab;
  padding: 0 20px; /* Add some padding for better centering */
  position: relative;
}

/* For macOS, offset the search box to account for traffic lights */
.titlebar.is-macos .titlebar-drag-region {
  margin-left: -85px; /* Half of traffic lights width to center properly */
}

.titlebar-drag-region:active {
  cursor: grabbing;
}

/* VS Code style search box */
.search-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 16px;
  background: #f3f3f3;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  font-size: 13px;
  color: #666;
  min-width: 280px;
  max-width: 400px;
  -webkit-app-region: no-drag; /* Prevent dragging on search box */
}

.search-box:hover {
  background: #ebebeb;
  border-color: #d0d0d0;
}

.search-box:active {
  background: #e0e0e0;
}

.search-icon {
  color: #888;
  flex-shrink: 0;
}

.search-text {
  font-weight: 500;
  color: #555;
}

.titlebar.is-macos .search-box {
  font-size: 12px;
  padding: 4px 14px;
  min-width: 280px;
  max-width: 400px;
}

/* Window controls for non-macOS */
.window-controls {
  display: flex;
  height: 100%;
  -webkit-app-region: no-drag; /* Prevent dragging on controls */
}

.control-button {
  width: 46px;
  height: 100%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
  transition: background-color 0.2s ease;
}

.control-button:hover {
  background: rgba(0, 0, 0, 0.1);
}

.control-button.close:hover {
  background: #e81123;
  color: white;
}

.control-button svg {
  pointer-events: none;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .titlebar {
    background: #2d2d2d;
    border-bottom-color: #404040;
  }

  .titlebar.is-macos {
    background: #323232;
    border-bottom-color: #484848;
  }

  .search-box {
    background: #404040;
    border-color: #555;
    color: #ccc;
  }

  .search-box:hover {
    background: #4a4a4a;
    border-color: #666;
  }

  .search-box:active {
    background: #555;
  }

  .search-icon {
    color: #aaa;
  }

  .search-text {
    color: #ddd;
  }

  .control-button {
    color: #ccc;
  }

  .control-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}
</style>