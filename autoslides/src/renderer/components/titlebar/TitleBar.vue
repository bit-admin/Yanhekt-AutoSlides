<template>
  <div class="flex h-[36px] items-center border-b border-border bg-surface relative z-modal select-none" :class="{ 'is-macos': isMacOS }">
    <!-- macOS traffic lights space -->
    <div v-if="isMacOS" class="h-full w-[78px] shrink-0"></div>

    <!-- Menu bar for non-macOS platforms -->
    <div v-if="!isMacOS" class="menu-bar flex h-full items-center pl-2">
      <div class="menu-item relative cursor-pointer select-none rounded-[3px] px-3 py-2 text-[13px] text-text transition-colors hover:bg-black/5 active:bg-black/10" @click="toggleFileMenu" ref="fileMenuTrigger">
        {{ $t('titlebar.file') }}
        <div v-if="showFileMenu" class="dropdown-menu absolute left-0 top-full z-dropdown mt-0.5 min-w-[200px] rounded-md border border-border bg-surface px-0 py-1 shadow-[0_4px_12px_rgba(0,0,0,0.15)]" @click.stop>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="showAbout">{{ $t('titlebar.aboutAutoSlides') }}</div>
          <div class="my-1 h-px bg-border"></div>
          <div class="menu-option disabled cursor-not-allowed text-text-muted hover:bg-transparent hover:!text-text-muted flex items-center justify-between px-4 py-2 text-[13px]">{{ $t('titlebar.new') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+N</span></div>
          <div class="menu-option disabled cursor-not-allowed text-text-muted hover:bg-transparent hover:!text-text-muted flex items-center justify-between px-4 py-2 text-[13px]">{{ $t('titlebar.open') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+O</span></div>
          <div class="my-1 h-px bg-border"></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="closeWindow">{{ $t('titlebar.close') }}</div>
        </div>
      </div>

      <div class="menu-item relative cursor-pointer select-none rounded-[3px] px-3 py-2 text-[13px] text-text transition-colors hover:bg-black/5 active:bg-black/10" @click="toggleEditMenu" ref="editMenuTrigger">
        {{ $t('titlebar.edit') }}
        <div v-if="showEditMenu" class="dropdown-menu absolute left-0 top-full z-dropdown mt-0.5 min-w-[200px] rounded-md border border-border bg-surface px-0 py-1 shadow-[0_4px_12px_rgba(0,0,0,0.15)]" @click.stop>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="executeEdit('undo')">{{ $t('titlebar.undo') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+Z</span></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="executeEdit('redo')">{{ $t('titlebar.redo') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+Y</span></div>
          <div class="my-1 h-px bg-border"></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="executeEdit('cut')">{{ $t('titlebar.cut') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+X</span></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="executeEdit('copy')">{{ $t('titlebar.copy') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+C</span></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="executeEdit('paste')">{{ $t('titlebar.paste') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+V</span></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="executeEdit('selectAll')">{{ $t('titlebar.selectAll') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+A</span></div>
        </div>
      </div>

      <div class="menu-item relative cursor-pointer select-none rounded-[3px] px-3 py-2 text-[13px] text-text transition-colors hover:bg-black/5 active:bg-black/10" @click="toggleViewMenu" ref="viewMenuTrigger">
        {{ $t('titlebar.view') }}
        <div v-if="showViewMenu" class="dropdown-menu absolute left-0 top-full z-dropdown mt-0.5 min-w-[200px] rounded-md border border-border bg-surface px-0 py-1 shadow-[0_4px_12px_rgba(0,0,0,0.15)]" @click.stop>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="menuReload">{{ $t('titlebar.reload') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+R</span></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="menuForceReload">{{ $t('titlebar.forceReload') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+Shift+R</span></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="menuToggleDevTools">{{ $t('titlebar.toggleDevTools') }} <span class="ml-5 text-[11px] text-text-secondary">F12</span></div>
          <div class="my-1 h-px bg-border"></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="menuResetZoom">{{ $t('titlebar.resetZoom') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+0</span></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="menuZoomIn">{{ $t('titlebar.zoomIn') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl++</span></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="menuZoomOut">{{ $t('titlebar.zoomOut') }} <span class="ml-5 text-[11px] text-text-secondary">Ctrl+-</span></div>
          <div class="my-1 h-px bg-border"></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="menuToggleFullscreen">{{ $t('titlebar.toggleFullscreen') }} <span class="ml-5 text-[11px] text-text-secondary">F11</span></div>
        </div>
      </div>

      <div class="menu-item relative cursor-pointer select-none rounded-[3px] px-3 py-2 text-[13px] text-text transition-colors hover:bg-black/5 active:bg-black/10" @click="toggleHelpMenu" ref="helpMenuTrigger">
        {{ $t('titlebar.help') }}
        <div v-if="showHelpMenu" class="dropdown-menu absolute left-0 top-full z-dropdown mt-0.5 min-w-[200px] rounded-md border border-border bg-surface px-0 py-1 shadow-[0_4px_12px_rgba(0,0,0,0.15)]" @click.stop>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="openGitHub">{{ $t('titlebar.visitGitHub') }}</div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="openITCenter">{{ $t('titlebar.itCenterSoftware') }}</div>
          <div class="my-1 h-px bg-border"></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="checkForUpdates">{{ $t('titlebar.checkForUpdates') }}</div>
          <div class="my-1 h-px bg-border"></div>
          <div class="menu-option flex items-center justify-between cursor-pointer px-4 py-2 text-[13px] text-text transition-colors hover:bg-accent hover:text-white" @click="openTermsAndConditions">{{ $t('titlebar.termsAndConditions') }}</div>
        </div>
      </div>
    </div>

    <!-- App title and drag area -->
    <div class="titlebar-drag-region flex flex-1 h-full items-center justify-center relative cursor-grab gap-4 px-5">
      <!-- Left link buttons -->
      <div class="link-buttons flex items-center gap-2">
        <button class="link-button flex h-7 w-7 items-center justify-center rounded border-none bg-transparent cursor-pointer text-text-secondary transition-all relative hover:bg-black/5 hover:text-text active:bg-black/10 active:scale-95" @click="openGitHub" :title="$t('titlebar.visitGitHub')">
          <svg class="pointer-events-none transition-transform" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </button>
        <button class="link-button flex h-7 w-7 items-center justify-center rounded border-none bg-transparent cursor-pointer text-text-secondary transition-all relative hover:bg-black/5 hover:text-text active:bg-black/10 active:scale-95" @click="openITCenter" :title="$t('titlebar.itCenterSoftware')">
          <svg class="pointer-events-none transition-transform" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
          </svg>
        </button>
      </div>

      <!-- VS Code style search box -->
      <button class="search-box flex min-w-[280px] max-w-[400px] cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-elevated px-4 py-1.5 font-[inherit] text-[13px] text-text-secondary transition-all hover:bg-hover hover:border-border-strong active:bg-border">
        <svg class="shrink-0 text-text-muted" width="14" height="14" viewBox="0 0 14 14">
          <path d="M6.5 1a5.5 5.5 0 0 1 4.383 8.823l2.647 2.647a.75.75 0 1 1-1.06 1.06l-2.647-2.647A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor"/>
        </svg>
        <span class="font-medium text-text-secondary">AutoSlides</span>
      </button>

      <!-- Feedback button with inline expand -->
      <div class="feedback-control group relative z-20 flex shrink-0 items-center" :class="{ expanded: showFeedbackActions }" @click.stop>
        <button class="feedback-trigger flex h-[25px] cursor-pointer items-center gap-1 rounded-md border border-border-input bg-elevated px-2 text-[12px] font-medium text-text-secondary transition-[background-color,color,border-color] hover:bg-black/5 hover:text-text active:bg-black/10" @click="toggleFeedbackActions" :title="$t('titlebar.feedback')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v6A1.5 1.5 0 0 0 2.5 11H4v2.5a.5.5 0 0 0 .82.384L7.714 11H13.5A1.5 1.5 0 0 0 15 9.5v-6A1.5 1.5 0 0 0 13.5 2h-11z"/>
          </svg>
          <span class="whitespace-nowrap">{{ $t('titlebar.feedback') }}</span>
          <svg class="transition-opacity" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.646 3.646a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 1 1-.708-.708L10.293 8 6.646 4.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>
        <div class="feedback-actions absolute left-[calc(100%-1px)] top-0 z-30 flex h-[25px] items-center gap-1 overflow-hidden whitespace-nowrap border border-transparent border-l-none rounded-r-md bg-transparent px-0 opacity-0 pointer-events-none transition-[max-width,opacity,padding,border-color,background-color] max-w-0" :class="{ interactive: showFeedbackActions }">
          <button class="feedback-action-button flex h-5 cursor-pointer items-center whitespace-nowrap rounded border border-border-strong bg-surface px-2 text-[11px] text-text transition-all hover:bg-accent hover:border-accent hover:text-white active:scale-[0.98]" :class="{ interactive: showFeedbackActions }" @click="openFeedbackIssue">{{ $t('titlebar.openIssue') }}</button>
          <button class="feedback-action-button flex h-5 cursor-pointer items-center whitespace-nowrap rounded border border-border-strong bg-surface px-2 text-[11px] text-text transition-all hover:bg-accent hover:border-accent hover:text-white active:scale-[0.98]" :class="{ interactive: showFeedbackActions }" @click="openFeedbackEmail">{{ $t('titlebar.sendEmail') }}</button>
        </div>
      </div>
    </div>

    <!-- Window controls for non-macOS -->
    <div v-if="!isMacOS" class="window-controls flex h-full">
      <button class="control-button flex h-full w-[46px] items-center justify-center border-none bg-transparent cursor-pointer text-text-secondary transition-all relative hover:bg-black/5 active:bg-black/10 active:scale-95" @click="minimizeWindow" :title="$t('titlebar.minimize')">
        <svg class="pointer-events-none transition-transform" width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5" width="8" height="2" fill="currentColor"/>
        </svg>
      </button>
      <button class="control-button flex h-full w-[46px] items-center justify-center border-none bg-transparent cursor-pointer text-text-secondary transition-all relative hover:bg-black/5 active:bg-black/10 active:scale-95" @click="maximizeWindow" :title="$t('titlebar.maximize')">
        <svg class="pointer-events-none transition-transform" width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
      </button>
      <button class="control-button-close flex h-full w-[46px] items-center justify-center border-none bg-transparent cursor-pointer text-text-secondary transition-all relative hover:bg-danger hover:text-white active:bg-danger-hover active:text-white" @click="closeWindow" :title="$t('titlebar.close')">
        <svg class="pointer-events-none transition-transform" width="12" height="12" viewBox="0 0 12 12">
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
import { useTour } from '@features/platform/useTour';
import UpdateManager from './UpdateManager.vue';

const { t: $t } = useI18n();
const { restartTour } = useTour();

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
</script>

<style scoped>
/* -webkit-app-region: Electron window dragging. Cannot be expressed as Tailwind utilities. */
.titlebar-drag-region {
  -webkit-app-region: drag;
}
.titlebar-drag-region:active {
  cursor: grabbing;
}

.menu-bar,
.search-box,
.link-buttons,
.link-button,
.feedback-control,
.feedback-actions.interactive,
.feedback-action-button.interactive,
.window-controls,
.control-button,
.control-button-close {
  -webkit-app-region: no-drag;
}

/* macOS search box sizing — token-based but needs the descendant selector for the platform class. */
.is-macos .search-box {
  padding: 4px 14px;
  font-size: 12px;
}

/* macOS drag region offset to center properly with traffic lights. */
.is-macos .titlebar-drag-region {
  margin-left: -85px;
}

/* Non-macOS drag region offset to center properly with window controls. */
.titlebar:not(.is-macos) .titlebar-drag-region {
  margin-right: 75px;
}

/* Feedback expand animation — multi-property transition with max-width collapse cannot be pure utilities. */
.feedback-actions {
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

/* Feedback trigger: remove right border-radius when expanded (actions panel attaches). */
.feedback-control.expanded .feedback-trigger {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right-color: transparent;
}

/* Feedback trigger hover when expanded — keeps left border transparent (seamless join). */
.feedback-control.expanded .feedback-trigger:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
</style>
