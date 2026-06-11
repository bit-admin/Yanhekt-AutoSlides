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

      <!-- Feedback button with inline expand -->
      <div class="feedback-control" :class="{ expanded: showFeedbackActions }" @click.stop>
        <button class="feedback-trigger" @click="toggleFeedbackActions" :title="$t('titlebar.feedback')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v6A1.5 1.5 0 0 0 2.5 11H4v2.5a.5.5 0 0 0 .82.384L7.714 11H13.5A1.5 1.5 0 0 0 15 9.5v-6A1.5 1.5 0 0 0 13.5 2h-11z"/>
          </svg>
          <span class="feedback-text">{{ $t('titlebar.feedback') }}</span>
          <svg class="feedback-chevron" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.646 3.646a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 1 1-.708-.708L10.293 8 6.646 4.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>
        <div class="feedback-actions" :class="{ interactive: showFeedbackActions }">
          <button class="feedback-action-button" :class="{ interactive: showFeedbackActions }" @click="openFeedbackIssue">{{ $t('titlebar.openIssue') }}</button>
          <button class="feedback-action-button" :class="{ interactive: showFeedbackActions }" @click="openFeedbackEmail">{{ $t('titlebar.sendEmail') }}</button>
        </div>
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
const showFeedbackActions = ref(false);

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
  if (!target.closest('.feedback-control')) {
    showFeedbackActions.value = false;
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
  showFeedbackActions.value = false;
  closeAllMenus();
  showFileMenu.value = !showFileMenu.value;
};

const toggleEditMenu = () => {
  showFeedbackActions.value = false;
  closeAllMenus();
  showEditMenu.value = !showEditMenu.value;
};

const toggleViewMenu = () => {
  showFeedbackActions.value = false;
  closeAllMenus();
  showViewMenu.value = !showViewMenu.value;
};

const toggleHelpMenu = () => {
  showFeedbackActions.value = false;
  closeAllMenus();
  showHelpMenu.value = !showHelpMenu.value;
};

const toggleFeedbackActions = () => {
  closeAllMenus();
  showFeedbackActions.value = !showFeedbackActions.value;
};

// Search box click handler
const handleSearchClick = () => {
  // TODO: wire this up to its new function
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

const openFeedbackIssue = async () => {
  showFeedbackActions.value = false;
  try {
    await (window as any).electronAPI.shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides/issues/new');
  } catch (error) {
    console.error('Failed to open issue page:', error);
  }
};

const openFeedbackEmail = async () => {
  showFeedbackActions.value = false;

  const now = new Date();
  const timestampLocal = now.toLocaleString();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
  let appVersion = updateManager.value?.getCurrentVersion() || '';
  if (!appVersion) {
    try {
      appVersion = await (window as any).electronAPI.app.getVersion();
    } catch (error) {
      console.error('Failed to get app version:', error);
    }
  }
  appVersion = appVersion || 'Unknown';
  const electronVersion = navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] || 'Unknown';
  const platform = navigator.platform || 'Unknown';

  const subject = encodeURIComponent(`[AutoSlides Feedback] ${timestampLocal.slice(0, 10)}`);
  const body = encodeURIComponent(
    `Hello AutoSlides Team,\n\n` +
    `- What happened:\n` +
    `- Steps to reproduce:\n` +
    `- Expected result:\n` +
    `- Actual result:\n` +
    `- Additional notes:\n\n` +
    `────────────────────────\n` +
    `Environment Snapshot\n` +
    `────────────────────────\n` +
    `Timestamp: ${timestampLocal}\n` +
    `Time zone: ${timezone}\n` +
    `App version: ${appVersion}\n` +
    `Electron: ${electronVersion}\n` +
    `Platform: ${platform}\n`
  );

  try {
    await (window as any).electronAPI.shell.openExternal(`mailto:info@ruc.edu.kg?subject=${subject}&body=${body}`);
  } catch (error) {
    console.error('Failed to open email client:', error);
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
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 280px;
  max-width: 400px;
  -webkit-app-region: no-drag; /* Prevent dragging on search box */
}

.search-box:hover {
  background: var(--bg-elevated);
  border-color: var(--border-strong);
}

.search-box:active {
  background: var(--bg-subtle);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.search-text {
  font-weight: 500;
  color: var(--text-secondary);
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
  color: var(--text-secondary);
  transition: all 0.2s ease;
  position: relative;
}

.link-button:hover {
  background: var(--hover-tint);
  color: var(--text-primary);
}

.link-button:active {
  background: var(--hover-tint-strong);
  transform: scale(0.95);
}

.link-button svg {
  pointer-events: none;
  transition: transform 0.15s ease;
}

.feedback-control {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  z-index: 20;
  -webkit-app-region: no-drag;
}

.feedback-trigger {
  height: 25px;
  border: 1px solid var(--border-input);
  border-radius: 6px;
  background: var(--bg-elevated);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.feedback-control.expanded .feedback-trigger {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.feedback-trigger:hover {
  background: var(--hover-tint);
  color: var(--text-primary);
}

.feedback-trigger:active {
  background: var(--hover-tint-strong);
}

.feedback-text {
  white-space: nowrap;
}

.feedback-chevron {
  transition: opacity 0.2s ease;
}

.feedback-actions {
  position: absolute;
  left: calc(100% - 1px);
  top: 0;
  height: 25px;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  white-space: nowrap;
  padding: 0;
  border: 1px solid transparent;
  border-left: none;
  border-radius: 0 6px 6px 0;
  background: transparent;
  pointer-events: none;
  z-index: 30;
  transition: max-width 0.25s ease, opacity 0.2s ease, padding 0.25s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.feedback-control.expanded .feedback-actions {
  max-width: 400px;
  opacity: 1;
  padding: 0 4px;
  border-color: var(--border-input);
  background: var(--bg-elevated);
  pointer-events: auto;
}

.feedback-action-button {
  height: 20px;
  border: 1px solid var(--border-color);
  background: var(--bg-surface);
  border-radius: 4px;
  padding: 0 8px;
  color: var(--text-primary);
  font-size: 11px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

.feedback-actions.interactive,
.feedback-action-button.interactive {
  -webkit-app-region: no-drag;
}

.feedback-action-button:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--text-on-accent);
}

.feedback-action-button:active {
  transform: scale(0.98);
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