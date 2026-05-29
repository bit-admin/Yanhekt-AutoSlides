<template>
  <div
    class="relative z-modal flex h-9 select-none items-center border-b"
    :class="isMacOS ? 'border-[#d0d0d0] bg-white dark:border-[#484848] dark:bg-[#323232]' : 'border-line bg-modal'"
  >
    <!-- macOS traffic lights space -->
    <div v-if="isMacOS" class="h-full w-[78px] flex-shrink-0"></div>

    <!-- Menu bar for non-macOS platforms -->
    <div v-if="!isMacOS" class="flex h-full items-center pl-2 [-webkit-app-region:no-drag]">
      <div :class="menuItemCls" @click="toggleFileMenu" ref="fileMenuTrigger">
        {{ $t('titlebar.file') }}
        <div v-if="showFileMenu" :class="dropdownCls" @click.stop>
          <div :class="menuOptionCls" @click="showAbout">{{ $t('titlebar.aboutAutoSlides') }}</div>
          <div :class="menuSepCls"></div>
          <div :class="menuOptionDisabledCls">{{ $t('titlebar.new') }} <span :class="shortcutCls">Ctrl+N</span></div>
          <div :class="menuOptionDisabledCls">{{ $t('titlebar.open') }} <span :class="shortcutCls">Ctrl+O</span></div>
          <div :class="menuSepCls"></div>
          <div :class="menuOptionCls" @click="closeWindow">{{ $t('titlebar.close') }}</div>
        </div>
      </div>

      <div :class="menuItemCls" @click="toggleEditMenu" ref="editMenuTrigger">
        {{ $t('titlebar.edit') }}
        <div v-if="showEditMenu" :class="dropdownCls" @click.stop>
          <div :class="menuOptionCls" @click="executeEdit('undo')">{{ $t('titlebar.undo') }} <span :class="shortcutCls">Ctrl+Z</span></div>
          <div :class="menuOptionCls" @click="executeEdit('redo')">{{ $t('titlebar.redo') }} <span :class="shortcutCls">Ctrl+Y</span></div>
          <div :class="menuSepCls"></div>
          <div :class="menuOptionCls" @click="executeEdit('cut')">{{ $t('titlebar.cut') }} <span :class="shortcutCls">Ctrl+X</span></div>
          <div :class="menuOptionCls" @click="executeEdit('copy')">{{ $t('titlebar.copy') }} <span :class="shortcutCls">Ctrl+C</span></div>
          <div :class="menuOptionCls" @click="executeEdit('paste')">{{ $t('titlebar.paste') }} <span :class="shortcutCls">Ctrl+V</span></div>
          <div :class="menuOptionCls" @click="executeEdit('selectAll')">{{ $t('titlebar.selectAll') }} <span :class="shortcutCls">Ctrl+A</span></div>
        </div>
      </div>

      <div :class="menuItemCls" @click="toggleViewMenu" ref="viewMenuTrigger">
        {{ $t('titlebar.view') }}
        <div v-if="showViewMenu" :class="dropdownCls" @click.stop>
          <div :class="menuOptionCls" @click="menuReload">{{ $t('titlebar.reload') }} <span :class="shortcutCls">Ctrl+R</span></div>
          <div :class="menuOptionCls" @click="menuForceReload">{{ $t('titlebar.forceReload') }} <span :class="shortcutCls">Ctrl+Shift+R</span></div>
          <div :class="menuOptionCls" @click="menuToggleDevTools">{{ $t('titlebar.toggleDevTools') }} <span :class="shortcutCls">F12</span></div>
          <div :class="menuSepCls"></div>
          <div :class="menuOptionCls" @click="menuResetZoom">{{ $t('titlebar.resetZoom') }} <span :class="shortcutCls">Ctrl+0</span></div>
          <div :class="menuOptionCls" @click="menuZoomIn">{{ $t('titlebar.zoomIn') }} <span :class="shortcutCls">Ctrl++</span></div>
          <div :class="menuOptionCls" @click="menuZoomOut">{{ $t('titlebar.zoomOut') }} <span :class="shortcutCls">Ctrl+-</span></div>
          <div :class="menuSepCls"></div>
          <div :class="menuOptionCls" @click="menuToggleFullscreen">{{ $t('titlebar.toggleFullscreen') }} <span :class="shortcutCls">F11</span></div>
        </div>
      </div>

      <div :class="menuItemCls" @click="toggleHelpMenu" ref="helpMenuTrigger">
        {{ $t('titlebar.help') }}
        <div v-if="showHelpMenu" :class="dropdownCls" @click.stop>
          <div :class="menuOptionCls" @click="openGitHub">{{ $t('titlebar.visitGitHub') }}</div>
          <div :class="menuOptionCls" @click="openITCenter">{{ $t('titlebar.itCenterSoftware') }}</div>
          <div :class="menuSepCls"></div>
          <div :class="menuOptionCls" @click="checkForUpdates">{{ $t('titlebar.checkForUpdates') }}</div>
          <div :class="menuSepCls"></div>
          <div :class="menuOptionCls" @click="openTermsAndConditions">{{ $t('titlebar.termsAndConditions') }}</div>
        </div>
      </div>
    </div>

    <!-- App title and drag area -->
    <div
      class="relative flex h-full flex-1 cursor-grab items-center justify-center gap-4 px-5 [-webkit-app-region:drag] active:cursor-grabbing"
      :class="isMacOS ? '-ml-[85px]' : 'mr-[75px]'"
    >
      <!-- Left link buttons -->
      <div class="flex items-center gap-2 [-webkit-app-region:no-drag]">
        <button :class="linkBtnCls" @click="openGitHub" :title="$t('titlebar.visitGitHub')">
          <svg class="pointer-events-none" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </button>
        <button :class="linkBtnCls" @click="openITCenter" :title="$t('titlebar.itCenterSoftware')">
          <svg class="pointer-events-none" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
          </svg>
        </button>
      </div>

      <!-- VS Code style search box ('search-box' retained as a tour hook) -->
      <button
        class="search-box flex min-w-[280px] max-w-[400px] cursor-pointer items-center justify-center gap-2 rounded-md border bg-[#f3f3f3] font-medium text-[#666] transition-all [-webkit-app-region:no-drag] border-[#e0e0e0] hover:border-[#d0d0d0] hover:bg-[#ebebeb] active:bg-[#e0e0e0] dark:border-[#555] dark:bg-[#404040] dark:text-[#ccc] dark:hover:border-[#666] dark:hover:bg-[#4a4a4a] dark:active:bg-[#555]"
        :class="isMacOS ? 'px-3.5 py-1 text-xs' : 'px-4 py-1.5 text-[13px]'"
        @click="handleSearchClick"
      >
        <svg class="shrink-0 text-[#888] dark:text-[#aaa]" width="14" height="14" viewBox="0 0 14 14">
          <path d="M6.5 1a5.5 5.5 0 0 1 4.383 8.823l2.647 2.647a.75.75 0 1 1-1.06 1.06l-2.647-2.647A5.5 5.5 0 1 1 6.5 1zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="currentColor"/>
        </svg>
        <span class="font-medium text-[#555] dark:text-[#ddd]">AutoSlides</span>
      </button>

      <!-- Feedback button with inline expand ('feedback-control' retained for outside-click handling) -->
      <div class="feedback-control relative z-20 flex flex-shrink-0 items-center [-webkit-app-region:no-drag]" @click.stop>
        <button
          class="flex h-[25px] cursor-pointer items-center gap-1 rounded-md border border-[#d9d9d9] bg-[#f8f8f8] px-2 text-xs font-medium text-[#555] transition-colors hover:bg-black/5 hover:text-[#333] active:bg-black/10 dark:border-[#585858] dark:bg-[#3b3b3b] dark:text-[#ddd] dark:hover:bg-white/[0.08] dark:hover:text-white dark:active:bg-white/15"
          :class="{ 'rounded-r-none dark:!border-[#6a6a6a]': showFeedbackActions }"
          @click="toggleFeedbackActions"
          :title="$t('titlebar.feedback')"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.5 2A1.5 1.5 0 0 0 1 3.5v6A1.5 1.5 0 0 0 2.5 11H4v2.5a.5.5 0 0 0 .82.384L7.714 11H13.5A1.5 1.5 0 0 0 15 9.5v-6A1.5 1.5 0 0 0 13.5 2h-11z"/>
          </svg>
          <span class="whitespace-nowrap">{{ $t('titlebar.feedback') }}</span>
          <svg class="transition-opacity" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6.646 3.646a.5.5 0 0 1 .708 0l4 4a.5.5 0 0 1 0 .708l-4 4a.5.5 0 1 1-.708-.708L10.293 8 6.646 4.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>
        <div
          class="absolute left-[calc(100%-1px)] top-0 z-30 flex h-[25px] items-center gap-1 overflow-hidden whitespace-nowrap rounded-r-md border border-l-0 transition-all duration-[250ms]"
          :class="showFeedbackActions
            ? 'pointer-events-auto max-w-[400px] border-[#d9d9d9] bg-[#f3f3f3] px-1 opacity-100 [-webkit-app-region:no-drag] dark:border-[#6a6a6a] dark:bg-[#434343]'
            : 'pointer-events-none max-w-0 border-transparent bg-transparent p-0 opacity-0'"
        >
          <button :class="feedbackActionCls" @click="openFeedbackIssue">{{ $t('titlebar.openIssue') }}</button>
          <button :class="feedbackActionCls" @click="openFeedbackEmail">{{ $t('titlebar.sendEmail') }}</button>
        </div>
      </div>
    </div>

    <!-- Window controls for non-macOS -->
    <div v-if="!isMacOS" class="flex h-full [-webkit-app-region:no-drag]">
      <button :class="[ctrlBtnBase, ctrlBtnHover]" @click="minimizeWindow" :title="$t('titlebar.minimize')">
        <svg class="pointer-events-none transition-transform" width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="5" width="8" height="2" fill="currentColor"/>
        </svg>
      </button>
      <button :class="[ctrlBtnBase, ctrlBtnHover]" @click="maximizeWindow" :title="$t('titlebar.maximize')">
        <svg class="pointer-events-none transition-transform" width="12" height="12" viewBox="0 0 12 12">
          <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
      </button>
      <button :class="[ctrlBtnBase, ctrlBtnClose]" @click="closeWindow" :title="$t('titlebar.close')">
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

// Shared chrome class strings. '.menu-item' is also matched by handleOutsideClick.
const menuItemCls =
  'menu-item relative cursor-pointer select-none rounded-[3px] px-3 py-2 text-[13px] text-[#333] transition-colors hover:bg-black/5 active:bg-black/10 dark:text-[#ccc] dark:hover:bg-white/[0.08] dark:active:bg-white/15';
const dropdownCls =
  'absolute left-0 top-full z-modal mt-0.5 min-w-[200px] rounded-md border border-[#d0d0d0] bg-modal py-1 shadow-[0_4px_12px_rgba(0,0,0,0.15)] dark:border-[#555]';
const menuOptionCls =
  'group flex cursor-pointer items-center justify-between px-4 py-2 text-[13px] text-[#333] transition-colors hover:bg-[#0078d4] hover:text-white dark:text-[#ccc]';
const menuOptionDisabledCls =
  'flex cursor-not-allowed items-center justify-between px-4 py-2 text-[13px] text-[#999] dark:text-[#666]';
const menuSepCls = 'my-1 h-px bg-line';
const shortcutCls = 'ml-5 text-[11px] text-[#666] group-hover:text-white/80 dark:text-[#888]';
const linkBtnCls =
  'relative flex h-7 w-7 cursor-pointer items-center justify-center rounded border-none bg-transparent text-[#666] transition-all hover:bg-black/5 hover:text-[#333] active:scale-95 active:bg-black/10 dark:text-[#ccc] dark:hover:bg-white/[0.08] dark:hover:text-white dark:active:bg-white/15';
const feedbackActionCls =
  'h-5 cursor-pointer whitespace-nowrap rounded border border-[#d0d0d0] bg-white px-2 text-[11px] text-[#444] transition-all [-webkit-app-region:no-drag] hover:border-[#0078d4] hover:bg-[#0078d4] hover:text-white active:scale-[0.98] dark:border-[#696969] dark:bg-[#4a4a4a] dark:text-[#e5e5e5]';
const ctrlBtnBase =
  'relative flex h-full w-[46px] items-center justify-center border-none bg-transparent text-[#666] cursor-pointer transition-all active:[&>svg]:scale-95 dark:text-[#ccc]';
const ctrlBtnHover = 'hover:bg-black/[0.08] active:bg-black/10 dark:hover:bg-white/10 dark:active:bg-white/15';
const ctrlBtnClose = 'hover:bg-[#c42b1c] hover:text-white active:bg-[#a23216] active:text-white';

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

