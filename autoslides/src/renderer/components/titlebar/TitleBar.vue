<template>
  <div class="titlebar" :class="{ 'is-macos': isMacOS }">
    <!-- macOS traffic lights space -->
    <div v-if="isMacOS" class="traffic-lights-space"></div>

    <!-- Menu bar for non-macOS platforms -->
    <div v-if="!isMacOS" class="menu-bar">
      <div class="menu-item" @click="toggleFileMenu" ref="fileMenuTrigger">
        {{ $t('titlebar.file') }}
        <div v-if="showFileMenu" class="dropdown-menu" @click.stop>
          <div class="menu-option" @click="showAbout">{{ $t('titlebar.aboutAutoSlides') }}</div>
          <div class="menu-separator"></div>
          <div class="menu-option" @click="openSettings">{{ $t('titlebar.settings') }} <span class="shortcut">Ctrl+,</span></div>
          <div class="menu-separator"></div>
          <div class="menu-option disabled">{{ $t('titlebar.new') }} <span class="shortcut">Ctrl+N</span></div>
          <div class="menu-option disabled">{{ $t('titlebar.open') }} <span class="shortcut">Ctrl+O</span></div>
          <div class="menu-separator"></div>
          <div class="menu-option" @click="closeWindow">{{ $t('titlebar.close') }}</div>
        </div>
      </div>

      <div class="menu-item" @click="toggleEditMenu" ref="editMenuTrigger">
        {{ $t('titlebar.edit') }}
        <div v-if="showEditMenu" class="dropdown-menu" @click.stop>
          <div class="menu-option" @click="executeEdit('undo')">{{ $t('titlebar.undo') }} <span class="shortcut">Ctrl+Z</span></div>
          <div class="menu-option" @click="executeEdit('redo')">{{ $t('titlebar.redo') }} <span class="shortcut">Ctrl+Y</span></div>
          <div class="menu-separator"></div>
          <div class="menu-option" @click="executeEdit('cut')">{{ $t('titlebar.cut') }} <span class="shortcut">Ctrl+X</span></div>
          <div class="menu-option" @click="executeEdit('copy')">{{ $t('titlebar.copy') }} <span class="shortcut">Ctrl+C</span></div>
          <div class="menu-option" @click="executeEdit('paste')">{{ $t('titlebar.paste') }} <span class="shortcut">Ctrl+V</span></div>
          <div class="menu-option" @click="executeEdit('selectAll')">{{ $t('titlebar.selectAll') }} <span class="shortcut">Ctrl+A</span></div>
        </div>
      </div>

      <div class="menu-item" @click="toggleViewMenu" ref="viewMenuTrigger">
        {{ $t('titlebar.view') }}
        <div v-if="showViewMenu" class="dropdown-menu" @click.stop>
          <div class="menu-option" @click="menuReload">{{ $t('titlebar.reload') }} <span class="shortcut">Ctrl+R</span></div>
          <div class="menu-option" @click="menuForceReload">{{ $t('titlebar.forceReload') }} <span class="shortcut">Ctrl+Shift+R</span></div>
          <div class="menu-option" @click="menuToggleDevTools">{{ $t('titlebar.toggleDevTools') }} <span class="shortcut">F12</span></div>
          <div class="menu-separator"></div>
          <div class="menu-option" @click="menuResetZoom">{{ $t('titlebar.resetZoom') }} <span class="shortcut">Ctrl+0</span></div>
          <div class="menu-option" @click="menuZoomIn">{{ $t('titlebar.zoomIn') }} <span class="shortcut">Ctrl++</span></div>
          <div class="menu-option" @click="menuZoomOut">{{ $t('titlebar.zoomOut') }} <span class="shortcut">Ctrl+-</span></div>
          <div class="menu-separator"></div>
          <div class="menu-option" @click="menuToggleFullscreen">{{ $t('titlebar.toggleFullscreen') }} <span class="shortcut">F11</span></div>
        </div>
      </div>

      <div class="menu-item" @click="toggleHelpMenu" ref="helpMenuTrigger">
        {{ $t('titlebar.help') }}
        <div v-if="showHelpMenu" class="dropdown-menu" @click.stop>
          <div class="menu-option" @click="openGitHub">{{ $t('titlebar.visitGitHub') }}</div>
          <div class="menu-option" @click="openITCenter">{{ $t('titlebar.itCenterSoftware') }}</div>
          <div class="menu-separator"></div>
          <div class="menu-option" @click="checkForUpdates">{{ $t('titlebar.checkForUpdates') }}</div>
          <div class="menu-separator"></div>
          <div class="menu-option" @click="openTermsAndConditions">{{ $t('titlebar.termsAndConditions') }}</div>
        </div>
      </div>
    </div>

    <!-- Drag area -->
    <div class="titlebar-drag-region"></div>

    <!-- Window controls for non-macOS -->
    <div v-if="!isMacOS" class="window-controls">
      <button class="control-button minimize" @click="minimizeWindow" :title="$t('titlebar.minimize')">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5" width="8" height="2" fill="currentColor"/>
        </svg>
      </button>
      <button class="control-button maximize" @click="maximizeWindow" :title="$t('titlebar.maximize')">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
      </button>
      <button class="control-button close" @click="closeWindow" :title="$t('titlebar.close')">
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    </div>

    <UpdateManager ref="updateManager" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import UpdateManager from './UpdateManager.vue';

const { t: $t } = useI18n();

const isMacOS = ref(false);

// Menu state
const showFileMenu = ref(false);
const showEditMenu = ref(false);
const showViewMenu = ref(false);
const showHelpMenu = ref(false);

// Menu refs
const fileMenuTrigger = ref<HTMLElement>();
const editMenuTrigger = ref<HTMLElement>();
const viewMenuTrigger = ref<HTMLElement>();
const helpMenuTrigger = ref<HTMLElement>();

// Reference to the extracted UpdateManager — exposes checkForUpdates() / autoCheckForUpdates()
const updateManager = ref<InstanceType<typeof UpdateManager> | null>(null);

onMounted(() => {
  // Detect platform using userAgent as navigator.platform is deprecated
  isMacOS.value = navigator.userAgent.toLowerCase().includes('mac');

  // Add click listener to close menus when clicking outside
  document.addEventListener('click', handleOutsideClick);
});

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick);
});

// Close all menus when clicking outside
const handleOutsideClick = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.menu-item')) {
    closeAllMenus();
  }
};

const closeAllMenus = () => {
  showFileMenu.value = false;
  showEditMenu.value = false;
  showViewMenu.value = false;
  showHelpMenu.value = false;
};

// Menu toggle functions
const toggleFileMenu = () => {
  closeAllMenus();
  showFileMenu.value = !showFileMenu.value;
};

const toggleEditMenu = () => {
  closeAllMenus();
  showEditMenu.value = !showEditMenu.value;
};

const toggleViewMenu = () => {
  closeAllMenus();
  showViewMenu.value = !showViewMenu.value;
};

const toggleHelpMenu = () => {
  closeAllMenus();
  showHelpMenu.value = !showHelpMenu.value;
};

// Window control functions for non-macOS platforms
const minimizeWindow = async () => {
  try {
    await (window as any).electronAPI.window.minimize();
  } catch (error) {
    console.error('Failed to minimize window:', error);
  }
};

const maximizeWindow = async () => {
  try {
    const result = await (window as any).electronAPI.window.maximize();
    if (result.success) {
      // Update maximize button icon based on window state
      updateMaximizeIcon(result.isMaximized);
    }
  } catch (error) {
    console.error('Failed to maximize/restore window:', error);
  }
};

const closeWindow = async () => {
  try {
    await (window as any).electronAPI.window.close();
  } catch (error) {
    console.error('Failed to close window:', error);
  }
};

// Update maximize button icon based on window state
const updateMaximizeIcon = (isMaximized: boolean) => {
  // This could be used to change the icon between maximize and restore
  console.log('Window maximized state:', isMaximized);
};

// Link button handlers
const openGitHub = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides');
  } catch (error) {
    console.error('Failed to open GitHub repository:', error);
  }
};

const openITCenter = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://it.ruc.edu.kg/zh/software');
  } catch (error) {
    console.error('Failed to open User Manual:', error);
  }
};

// Menu action functions
const executeEdit = (action: string) => {
  closeAllMenus();
  document.execCommand(action);
};

const menuReload = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.reload();
  } catch (error) {
    console.error('Failed to reload:', error);
  }
};

const menuForceReload = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.forceReload();
  } catch (error) {
    console.error('Failed to force reload:', error);
  }
};

const menuToggleDevTools = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.toggleDevTools();
  } catch (error) {
    console.error('Failed to toggle dev tools:', error);
  }
};

const menuResetZoom = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.resetZoom();
  } catch (error) {
    console.error('Failed to reset zoom:', error);
  }
};

const menuZoomIn = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.zoomIn();
  } catch (error) {
    console.error('Failed to zoom in:', error);
  }
};

const menuZoomOut = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.zoomOut();
  } catch (error) {
    console.error('Failed to zoom out:', error);
  }
};

const menuToggleFullscreen = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.toggleFullscreen();
  } catch (error) {
    console.error('Failed to toggle fullscreen:', error);
  }
};

const openTermsAndConditions = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.openTermsAndConditions();
  } catch (error) {
    console.error('Failed to open Terms and Conditions:', error);
  }
};

const showAbout = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.dialog.showMessageBox({
      type: 'info',
      title: $t('titlebar.aboutTitle'),
      message: $t('titlebar.aboutMessage'),
      detail: $t('titlebar.aboutDetail'),
      buttons: [$t('titlebar.ok')]
    });
  } catch (error) {
    console.error('Failed to show about dialog:', error);
  }
};

// Check for updates — delegates to UpdateManager
const checkForUpdates = () => {
  closeAllMenus();
  updateManager.value?.checkForUpdates();
};

// Open Settings — routed through main so LeftPanel's listener opens the modal
const openSettings = () => {
  closeAllMenus();
  (window as any).electronAPI.menu.openSettings();
};
</script>

<style scoped>
.titlebar {
  display: flex;
  align-items: center;
  height: 36px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
  user-select: none;
  position: relative;
  z-index: 1000;
}

.titlebar.is-macos {
  height: 36px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border-color);
}

/* macOS frosted sidebar: the segment above the left panel stays transparent
   so the window vibrancy continues to the top of the window (Apple Music
   style). The background splits at --left-panel-width (set reactively by
   App.vue): glass | 1px vertical hairline | opaque bar. The bottom hairline
   is drawn only over the opaque segment. */
html.platform-darwin .titlebar.is-macos {
  border-bottom: none;
  background:
    linear-gradient(var(--border-color), var(--border-color))
      right bottom / calc(100% - var(--left-panel-width)) 1px no-repeat,
    linear-gradient(to right,
      transparent calc(var(--left-panel-width) - 1px),
      var(--border-color) calc(var(--left-panel-width) - 1px),
      var(--border-color) var(--left-panel-width),
      var(--bg-elevated) var(--left-panel-width))
      left top / 100% 100% no-repeat;
}

/* macOS traffic lights space - reserve space for red/yellow/green buttons */
.traffic-lights-space {
  width: 78px; /* Standard macOS traffic lights width */
  height: 100%;
  flex-shrink: 0;
}

/* Menu bar for non-macOS platforms */
.menu-bar {
  display: flex;
  align-items: center;
  height: 100%;
  padding-left: 8px;
  -webkit-app-region: no-drag;
}

.menu-item {
  position: relative;
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  border-radius: 3px;
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background-color: var(--hover-tint);
}

.menu-item:active {
  background-color: var(--hover-tint-strong);
}

/* Dropdown menu */
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  padding: 4px 0;
  margin-top: 2px;
}

.menu-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.menu-option:hover:not(.disabled) {
  background-color: var(--accent);
  color: var(--text-on-accent);
}

.menu-option.disabled {
  color: var(--text-muted);
  cursor: not-allowed;
}

.menu-option.disabled:hover {
  background-color: transparent;
  color: var(--text-muted);
}

.menu-separator {
  height: 1px;
  background-color: var(--border-color);
  margin: 4px 0;
}

.shortcut {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: 20px;
}

.menu-option:hover:not(.disabled) .shortcut {
  color: rgba(255, 255, 255, 0.8);
}

/* Drag region - allows window dragging */
.titlebar-drag-region {
  flex: 1;
  height: 100%;
  -webkit-app-region: drag; /* Enable dragging */
  cursor: grab;
}

.titlebar-drag-region:active {
  cursor: grabbing;
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
  color: var(--text-secondary);
  transition: all 0.15s ease;
  position: relative;
}

.control-button:hover {
  background: var(--hover-tint);
}

.control-button:active {
  background: var(--hover-tint-strong);
}

/* Windows 11 style hover effects */
.control-button.minimize:hover {
  background: rgba(0, 0, 0, 0.08);
}

.control-button.maximize:hover {
  background: rgba(0, 0, 0, 0.08);
}

.control-button.close:hover {
  background: #c42b1c;
  color: var(--text-on-accent);
}

.control-button.close:active {
  background: #a23216;
  color: var(--text-on-accent);
}

.control-button svg {
  pointer-events: none;
  transition: transform 0.15s ease;
}

.control-button:active svg {
  transform: scale(0.95);
}


</style>