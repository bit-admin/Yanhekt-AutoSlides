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
          <div class="menu-option" @click="openWebVersion">{{ $t('titlebar.webVersion') }}</div>
          <div class="menu-option" @click="openSSIMTest">{{ $t('titlebar.ssimTest') }}</div>
          <div class="menu-separator"></div>
          <div class="menu-option" @click="checkForUpdates">{{ $t('titlebar.checkForUpdates') }}</div>
          <div class="menu-separator"></div>
          <div class="menu-option" @click="openTermsAndConditions">{{ $t('titlebar.termsAndConditions') }}</div>
        </div>
      </div>
    </div>

    <!-- App title and drag area -->
    <div class="titlebar-drag-region">
      <!-- Left link buttons -->
      <div class="link-buttons left">
        <button class="link-button" @click="openGitHub" :title="$t('titlebar.visitGitHub')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </button>
        <button class="link-button" @click="openITCenter" :title="$t('titlebar.itCenterSoftware')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
          </svg>
        </button>
      </div>

      <!-- VS Code style search box -->
      <button class="search-box" @click="handleSearchClick">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14">
          <path d="M6.5 1a5.5 5.5 0 0 1 4.383 8.823l2.647 2.647a.75.75 0 1 1-1.06 1.06l-2.647-2.647A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor"/>
        </svg>
        <span class="search-text">AutoSlides</span>
      </button>

      <!-- Right link buttons -->
      <div class="link-buttons right">
        <button class="link-button" @click="openWebVersion" :title="$t('titlebar.webVersion')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077zM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09zm-.582 3.5c.03-.877.138-1.718.312-2.5H1.674a6.958 6.958 0 0 0-.656 2.5h2.49zM4.847 5a12.5 12.5 0 0 0-.338 2.5H7.5V5H4.847zM8.5 5v2.5h2.99a12.495 12.495 0 0 0-.337-2.5H8.5zM4.51 8.5a12.5 12.5 0 0 0 .337 2.5H7.5V8.5H4.51zm3.99 0V11h2.653c.187-.765.306-1.608.338-2.5H8.5zM5.145 12c.138.386.295.744.468 1.068.552 1.035 1.218 1.65 1.887 1.855V12H5.145zm.182 2.472a6.696 6.696 0 0 1-.597-.933A9.268 9.268 0 0 1 4.09 12H2.255a7.024 7.024 0 0 0 3.072 2.472zM3.82 11a13.652 13.652 0 0 1-.312-2.5h-2.49c.062.89.291 1.733.656 2.5H3.82zm6.853 3.472A7.024 7.024 0 0 0 13.745 12H11.91a9.27 9.27 0 0 1-.64 1.539 6.688 6.688 0 0 1-.597.933zM8.5 12v2.923c.67-.204 1.335-.82 1.887-1.855.173-.324.33-.682.468-1.068H8.5zm3.68-1h2.146c.365-.767.594-1.61.656-2.5h-2.49a13.65 13.65 0 0 1-.312 2.5zm2.802-6.5h-2.49A13.65 13.65 0 0 1 12.18 5h2.146c-.365-.767-.594-1.61-.656-2.5zM11.27 2.461c.247.464.462.98.64 1.539h1.835a7.024 7.024 0 0 0-3.072-2.472c.218.284.418.598.597.933zM10.855 4a7.966 7.966 0 0 0-.468-1.068C9.835 1.897 9.17 1.282 8.5 1.077V4h2.355z"/>
          </svg>
        </button>
        <button class="link-button" @click="openSSIMTest" :title="$t('titlebar.ssimTest')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.002 5.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/>
            <path d="M2.002 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2h-12zm12 1a1 1 0 0 1 1 1v6.5l-3.777-1.947a.5.5 0 0 0-.577.093l-3.71 3.71-2.66-1.772a.5.5 0 0 0-.63.062L1.002 12V3a1 1 0 0 1 1-1h12z"/>
          </svg>
        </button>
      </div>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTour } from '../composables/useTour';

const { t: $t } = useI18n();
const { restartTour } = useTour();

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

onMounted(() => {
  // Detect platform using userAgent as navigator.platform is deprecated
  isMacOS.value = navigator.userAgent.toLowerCase().includes('mac');

  // Add click listener to close menus when clicking outside
  document.addEventListener('click', handleOutsideClick);

  // Listen for check for updates event from macOS menu
  (window as any).electronAPI.update.onCheckForUpdates(() => {
    checkForUpdates();
  });
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

// Search box click handler
const handleSearchClick = () => {
  // Restart the UI tour
  restartTour();
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

const openSSIMTest = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://learn.ruc.edu.kg/test');
  } catch (error) {
    console.error('Failed to open SSIM Test:', error);
  }
};

const openWebVersion = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://learn.ruc.edu.kg');
  } catch (error) {
    console.error('Failed to open Web Version:', error);
  }
};

const openITCenter = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://it.ruc.edu.kg/zh/software');
  } catch (error) {
    console.error('Failed to open IT Center Software List:', error);
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

// Check for updates
const checkForUpdates = async () => {
  closeAllMenus();
  try {
    const result = await (window as any).electronAPI.update.checkForUpdates();

    if (!result.success) {
      // Failed to check for updates
      await (window as any).electronAPI.dialog.showMessageBox({
        type: 'error',
        title: $t('titlebar.updateCheckFailed'),
        message: $t('titlebar.updateCheckFailedMessage'),
        detail: $t('titlebar.updateCheckFailedDetail', { error: result.error }),
        buttons: [$t('titlebar.ok')]
      });
      return;
    }

    if (result.hasUpdate) {
      // Update available - show dialog with option to open download page
      const response = await (window as any).electronAPI.dialog.showMessageBox({
        type: 'info',
        title: $t('titlebar.updateAvailable'),
        message: $t('titlebar.updateAvailableMessage'),
        detail: $t('titlebar.updateAvailableDetail', {
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion
        }),
        buttons: [$t('titlebar.openDownloadPage'), $t('titlebar.cancel')]
      });

      if (response.response === 0) {
        // User clicked "Open Download Page"
        await (window as any).electronAPI.shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides/releases');
      }
    } else {
      // No update available
      await (window as any).electronAPI.dialog.showMessageBox({
        type: 'info',
        title: $t('titlebar.noUpdateAvailable'),
        message: $t('titlebar.noUpdateMessage'),
        detail: $t('titlebar.noUpdateDetail', { currentVersion: result.currentVersion }),
        buttons: [$t('titlebar.ok')]
      });
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
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
  color: #333;
  cursor: pointer;
  user-select: none;
  border-radius: 3px;
  transition: background-color 0.15s ease;
}

.menu-item:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.menu-item:active {
  background-color: rgba(0, 0, 0, 0.1);
}

/* Dropdown menu */
.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 200px;
  background: #ffffff;
  border: 1px solid #d0d0d0;
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
  color: #333;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.menu-option:hover:not(.disabled) {
  background-color: #0078d4;
  color: white;
}

.menu-option.disabled {
  color: #999;
  cursor: not-allowed;
}

.menu-option.disabled:hover {
  background-color: transparent;
  color: #999;
}

.menu-separator {
  height: 1px;
  background-color: #e0e0e0;
  margin: 4px 0;
}

.shortcut {
  font-size: 11px;
  color: #666;
  margin-left: 20px;
}

.menu-option:hover:not(.disabled) .shortcut {
  color: rgba(255, 255, 255, 0.8);
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
  gap: 16px; /* Space between link buttons and search box */
}

/* For macOS, offset the search box to account for traffic lights */
.titlebar.is-macos .titlebar-drag-region {
  margin-left: -85px; /* Half of traffic lights width to center properly */
}

/* For non-macOS, offset the search box to account for window controls on the right */
.titlebar:not(.is-macos) .titlebar-drag-region {
  margin-right: 75px; /* Half of window controls width (138px / 2) to center properly */
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

/* Link buttons */
.link-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag; /* Prevent dragging on link buttons */
}

.link-button {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #666;
  transition: all 0.2s ease;
  position: relative;
}

.link-button:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

.link-button:active {
  background: rgba(0, 0, 0, 0.1);
  transform: scale(0.95);
}

.link-button svg {
  pointer-events: none;
  transition: transform 0.15s ease;
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
  transition: all 0.15s ease;
  position: relative;
}

.control-button:hover {
  background: rgba(0, 0, 0, 0.05);
}

.control-button:active {
  background: rgba(0, 0, 0, 0.1);
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
  color: white;
}

.control-button.close:active {
  background: #a23216;
  color: white;
}

.control-button svg {
  pointer-events: none;
  transition: transform 0.15s ease;
}

.control-button:active svg {
  transform: scale(0.95);
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
    background: rgba(255, 255, 255, 0.08);
  }

  .control-button:active {
    background: rgba(255, 255, 255, 0.15);
  }

  .control-button.minimize:hover,
  .control-button.maximize:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .control-button.close:hover {
    background: #c42b1c;
    color: white;
  }

  .control-button.close:active {
    background: #a23216;
    color: white;
  }

  .link-button {
    color: #ccc;
  }

  .link-button:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .link-button:active {
    background: rgba(255, 255, 255, 0.15);
  }

  /* Menu bar dark mode */
  .menu-item {
    color: #ccc;
  }

  .menu-item:hover {
    background-color: rgba(255, 255, 255, 0.08);
  }

  .menu-item:active {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .dropdown-menu {
    background: #2d2d2d;
    border-color: #555;
  }

  .menu-option {
    color: #ccc;
  }

  .menu-option:hover:not(.disabled) {
    background-color: #0078d4;
    color: white;
  }

  .menu-option.disabled {
    color: #666;
  }

  .menu-separator {
    background-color: #555;
  }

  .shortcut {
    color: #888;
  }
}
</style>