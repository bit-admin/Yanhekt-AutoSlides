<template>
  <div class="titlebar" :class="{ 'is-macos': isMacOS }" :style="reserveStyle">
    <!-- Leading cluster: traffic lights (macOS) / menu bar (Win-Linux) + the
         left-panel collapse toggle. Measured (leadRef) to publish --lead-reserve
         so the absolutely-positioned tab strip never slides under it when the
         sidebar collapses. -->
    <div ref="leadRef" class="titlebar-lead">
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

      <!-- Left-panel collapse toggle. On macOS it sits right after the traffic
           lights (Safari idiom). On Win-Linux it moves into the center drag band
           instead (see the tab strip below), so it's not crammed against the
           menu bar. -->
      <button
        v-if="isMacOS"
        class="panel-toggle panel-toggle--lead"
        :class="{ active: layoutStore.leftCollapsed }"
        @click="toggleLeftPanel"
        :title="$t('titlebar.toggleLeftPanel')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2"/>
          <line x1="9" y1="4" x2="9" y2="20"/>
        </svg>
      </button>
    </div>

    <!-- Drag area -->
    <div class="titlebar-drag-region"></div>

    <!-- Tab strip — Info tab + one chip per open playback tab. Sits over the
         main-content segment (left panel edge → right panel edge). The strip
         background stays draggable; chips opt out. Hidden during browser login.
         Tabs that don't fit collapse into a "···" overflow dropdown rather than
         scrolling horizontally. -->
    <div v-if="!isBrowserLoginActive" ref="stripRef" class="tab-strip">
      <!-- Non-macOS: left-panel toggle at the leading edge of the center drag
           band (the macOS variant lives next to the traffic lights instead). -->
      <button
        v-if="!isMacOS"
        class="panel-toggle panel-toggle--center"
        :class="{ active: layoutStore.leftCollapsed }"
        @click="toggleLeftPanel"
        :title="$t('titlebar.toggleLeftPanel')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2"/>
          <line x1="9" y1="4" x2="9" y2="20"/>
        </svg>
      </button>
      <button
        ref="infoRef"
        :class="['tab-chip', 'tab-chip--info', { active: tabStore.state.activeTabId === null }]"
        @click="tabStore.activateTab(null)"
        :title="infoTabLabel"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="11" x2="12" y2="16"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span class="tab-chip-label">{{ infoTabLabel }}</span>
      </button>
      <button
        v-for="tab in visibleTabs"
        :key="tab.id"
        :class="['tab-chip', { active: tabStore.state.activeTabId === tab.id }]"
        @click="tabStore.activateTab(tab.id)"
        :title="tab.title"
      >
        <span :class="['tab-chip-dot', `mode-${tab.mode}`]"></span>
        <span class="tab-chip-label">{{ tab.title }}</span>
        <span
          :class="['tab-chip-close', { disabled: !isTabClosable(tab) }]"
          @click.stop="isTabClosable(tab) && tabStore.closeTab(tab.id)"
          :title="isTabClosable(tab) ? $t('tabs.close') : $t('tabs.closeDisabledTask')"
        >×</span>
      </button>

      <!-- Overflow: tabs that don't fit live in a dropdown opened by this chip.
           The menu is teleported to <body> so it escapes the strip's
           overflow:hidden clip; positioned with fixed coords from the button. -->
      <div v-if="overflowTabs.length" class="tab-overflow">
        <button
          ref="overflowBtnRef"
          :class="['tab-chip', 'tab-overflow-btn', { active: overflowHasActive }]"
          @click.stop="toggleOverflow"
          :title="$t('tabs.moreTabs')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="19" cy="12" r="2"/>
          </svg>
          <span class="tab-overflow-count">{{ overflowTabs.length }}</span>
        </button>
      </div>

      <!-- Non-macOS: right-panel toggle pushed to the trailing edge of the
           center drag band (margin-left:auto). macOS keeps it at the far right. -->
      <button
        v-if="!isMacOS && !isWorkspacePage"
        class="panel-toggle panel-toggle--center panel-toggle--center-trail"
        :class="{ active: layoutStore.rightCollapsed }"
        @click="toggleRightPanel"
        :title="$t('titlebar.toggleRightPanel')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2"/>
          <line x1="15" y1="4" x2="15" y2="20"/>
        </svg>
      </button>
    </div>

    <Teleport to="body">
      <div
        v-if="showOverflow && overflowTabs.length"
        class="tab-overflow-menu custom-scrollbar"
        :style="overflowMenuStyle"
        @click.stop
      >
        <button
          v-for="tab in overflowTabs"
          :key="tab.id"
          :class="['tab-overflow-item', { active: tabStore.state.activeTabId === tab.id }]"
          @click="selectOverflowTab(tab.id)"
          :title="tab.title"
        >
          <span :class="['tab-chip-dot', `mode-${tab.mode}`]"></span>
          <span class="tab-overflow-item-label">{{ tab.title }}</span>
          <span
            :class="['tab-chip-close', { disabled: !isTabClosable(tab) }]"
            @click.stop="isTabClosable(tab) && tabStore.closeTab(tab.id)"
            :title="isTabClosable(tab) ? $t('tabs.close') : $t('tabs.closeDisabledTask')"
          >×</span>
        </button>
      </div>
    </Teleport>

    <!-- Right-panel view switcher (Task / Download), hosted in the title bar
         above the right panel. Hidden during full-screen browser login and on
         full-width Workspace pages (no right panel to switch). -->
    <div v-if="!isBrowserLoginActive && !isWorkspacePage" class="view-switcher">
      <button
        :class="['view-tab', { active: rightPanelStore.currentTab === 'task' }]"
        @click="setRightPanelTab('task')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 11l3 3 8-8"/>
          <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9c1.66 0 3.22.45 4.56 1.24"/>
        </svg>
        {{ $t('navigation.task') }}
      </button>
      <button
        :class="['view-tab', { active: rightPanelStore.currentTab === 'download' }]"
        @click="setRightPanelTab('download')"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7,10 12,15 17,10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        {{ $t('navigation.download') }}
      </button>
    </div>

    <!-- Trailing cluster: right-panel collapse toggle + (non-macOS) window
         controls. Measured (trailRef) to publish --trail-reserve so the tab
         strip and view switcher stay clear of it. On macOS this is just the
         toggle at the far right; on Win-Linux the toggle sits left of min/max/
         close. -->
    <div ref="trailRef" class="titlebar-trail">
      <!-- Right-panel collapse toggle. macOS only here (far right); on Win-Linux
           it lives at the right edge of the center drag band (see the tab
           strip). -->
      <button
        v-if="isMacOS && !isWorkspacePage"
        class="panel-toggle panel-toggle--trail"
        :class="{ active: layoutStore.rightCollapsed }"
        @click="toggleRightPanel"
        :title="$t('titlebar.toggleRightPanel')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2"/>
          <line x1="15" y1="4" x2="15" y2="20"/>
        </svg>
      </button>

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

    <UpdateManager ref="updateManager" />
  </div>
</template>

<script setup lang="ts">
import { createLogger } from '@shared/utils/logger';
const log = createLogger('TitleBar');
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import UpdateManager from './UpdateManager.vue';
import { rightPanelStore, setRightPanelTab } from '@shared/services/rightPanelStore';
import { layoutStore, toggleLeftPanel, toggleRightPanel } from '@shared/services/layoutStore';
import { tabStore, type PlaybackTab } from '@features/course/tabStore';
import { navigationStore } from '@features/course/navigationStore';
import { useAuth } from '@features/platform/useAuth';
import { taskQueueState } from '@shared/services/taskQueueService';

const { t: $t } = useI18n();

// True when a full-width Workspace page (e.g. Slides Review) owns the content
// area: the right-panel view switcher + collapse toggles are hidden.
const { isWorkspacePage } = navigationStore;

// The Info tab chip is renamed to match the page it shows: Home / Search / Live,
// Recorded → Sessions once a course's sessions list is open, plus Workspace pages.
const infoTabLabel = computed(() => {
  switch (navigationStore.activeNav.value) {
    case 'home':
      return $t('tabs.home');
    case 'search':
      return $t('tabs.search');
    case 'live':
      return $t('tabs.live');
    case 'recorded':
      return navigationStore.recordedOnSessions.value
        ? $t('tabs.sessions')
        : $t('tabs.recorded');
    case 'slides-review':
      return $t('tabs.slidesReview');
    case 'cloud-notes':
      return $t('tabs.cloudNotes');
    case 'settings':
      return $t('tabs.settings');
    default:
      return $t('tabs.info');
  }
});

// A task tab can't be closed while its task is in progress — mirrors the
// disabled Back button inside the PlaybackPage. Manual tabs are always closable.
const isTabClosable = (tab: PlaybackTab): boolean => {
  if (tab.origin !== 'task' || !tab.taskId) return true;
  const task = taskQueueState.value.tasks.find(t => t.id === tab.taskId);
  return !task || task.status !== 'in_progress';
};

// Module-singleton ref: stays in sync with the App-level browser-login state.
const { isBrowserLoginActive } = useAuth();

// --- Tab overflow ("···" dropdown) ---------------------------------------
// Rather than scrolling the strip horizontally, tabs that don't fit collapse
// into a dropdown. We size the visible run from the strip's measured width
// using a fixed per-tab slot (deterministic — no per-chip measurement pass).
const stripRef = ref<HTMLElement | null>(null);
const infoRef = ref<HTMLElement | null>(null);
const overflowBtnRef = ref<HTMLElement | null>(null);

// --- Leading/trailing reserve (collapse-toggle clearance) -----------------
// The tab strip and view switcher are absolutely positioned off
// --left/right-panel-width. When a panel collapses those vars go to 0 and the
// strips would slide under the traffic lights / menu bar / toggles / window
// controls. We measure the actual leading & trailing control clusters and
// publish their widths as --lead-reserve / --trail-reserve; the strip anchors
// clamp to them via max(). Measured (not hard-coded) so locale-width menu bars
// and the macOS-vs-Windows trailing difference are handled automatically.
const leadRef = ref<HTMLElement | null>(null);
const trailRef = ref<HTMLElement | null>(null);
const reserveStyle = ref<Record<string, string>>({});
let reserveObserver: ResizeObserver | null = null;

const measureReserves = () => {
  reserveStyle.value = {
    '--lead-reserve': `${leadRef.value?.offsetWidth ?? 0}px`,
    '--trail-reserve': `${trailRef.value?.offsetWidth ?? 0}px`,
  };
};
const visibleCount = ref<number>(Number.POSITIVE_INFINITY);
const showOverflow = ref(false);
const overflowMenuStyle = ref<Record<string, string>>({});

const TAB_SLOT = 220;      // matches .tab-chip max-width
const OVERFLOW_SLOT = 56;  // the "···" button
const GAP = 4;             // .tab-strip gap
const CENTER_TOGGLE_SLOT = 36; // .panel-toggle width + margins (non-macOS in-strip toggles)

const visibleTabs = computed(() => tabStore.state.tabs.slice(0, visibleCount.value));
const overflowTabs = computed(() => tabStore.state.tabs.slice(visibleCount.value));
const overflowHasActive = computed(() =>
  overflowTabs.value.some(tab => tab.id === tabStore.state.activeTabId)
);

const recomputeTabs = () => {
  const strip = stripRef.value;
  const total = tabStore.state.tabs.length;
  if (!strip || total === 0) {
    visibleCount.value = total;
    return;
  }
  const styles = getComputedStyle(strip);
  const padding = parseFloat(styles.paddingLeft || '0') + parseFloat(styles.paddingRight || '0');
  const infoW = infoRef.value?.offsetWidth ?? 0;
  // On non-macOS the strip also hosts the two collapse toggles (left edge +
  // right edge); reserve their slots so tabs never overlap them.
  const centerToggles = isMacOS.value ? 0 : 2 * (CENTER_TOGGLE_SLOT + GAP);
  const available = strip.clientWidth - padding - infoW - GAP - centerToggles;
  const perTab = TAB_SLOT + GAP;

  let fit = Math.floor(available / perTab);
  if (fit >= total) {
    visibleCount.value = total;
    return;
  }
  // Need the overflow chip — reserve its slot, then refit the remainder.
  const availForTabs = available - OVERFLOW_SLOT - GAP;
  visibleCount.value = Math.max(0, Math.floor(availForTabs / perTab));

  // Keep an open menu pinned to the (possibly moved) button.
  if (showOverflow.value) nextTick(positionOverflowMenu);
};

// The menu lives in a Teleport to <body>; anchor it under the "···" button
// using fixed coordinates (right-aligned to the button's right edge).
const positionOverflowMenu = () => {
  const btn = overflowBtnRef.value;
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  overflowMenuStyle.value = {
    top: `${rect.bottom + 4}px`,
    right: `${Math.max(8, window.innerWidth - rect.right)}px`
  };
};

const toggleOverflow = () => {
  showOverflow.value = !showOverflow.value;
  if (showOverflow.value) nextTick(positionOverflowMenu);
};

const selectOverflowTab = (id: string) => {
  tabStore.activateTab(id);
  showOverflow.value = false;
};

let stripObserver: ResizeObserver | null = null;

// Recompute whenever the tab set changes (after the DOM settles).
watch(
  () => tabStore.state.tabs.length,
  () => nextTick(recomputeTabs)
);

// Close the dropdown if it empties out.
watch(overflowTabs, (tabs) => {
  if (tabs.length === 0) showOverflow.value = false;
});

const attachStripObserver = () => {
  stripObserver?.disconnect();
  stripObserver = null;
  if (!stripRef.value) return;
  stripObserver = new ResizeObserver(() => recomputeTabs());
  stripObserver.observe(stripRef.value);
  recomputeTabs();
};

// The strip only exists while not in full-screen browser login; (re)bind the
// observer to the fresh element whenever it mounts.
watch(isBrowserLoginActive, (active) => {
  if (active) {
    stripObserver?.disconnect();
    stripObserver = null;
  } else {
    nextTick(attachStripObserver);
  }
});

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

  // Re-fit the visible tab run whenever the strip's width changes (panel
  // resize, window resize, traffic-light reserve, etc.).
  nextTick(attachStripObserver);

  // Measure the leading/trailing control clusters so the strip anchors can
  // clamp to them. Re-measures on locale change (menu-bar width shifts) etc.
  nextTick(() => {
    measureReserves();
    reserveObserver = new ResizeObserver(() => measureReserves());
    if (leadRef.value) reserveObserver.observe(leadRef.value);
    if (trailRef.value) reserveObserver.observe(trailRef.value);
  });
});

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick);
  stripObserver?.disconnect();
  stripObserver = null;
  reserveObserver?.disconnect();
  reserveObserver = null;
});

// Close all menus when clicking outside
const handleOutsideClick = (event: Event) => {
  const target = event.target as HTMLElement;
  if (!target.closest('.menu-item')) {
    closeAllMenus();
  }
  if (!target.closest('.tab-overflow')) {
    showOverflow.value = false;
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
    log.error('Failed to minimize window:', error);
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
    log.error('Failed to maximize/restore window:', error);
  }
};

const closeWindow = async () => {
  try {
    await (window as any).electronAPI.window.close();
  } catch (error) {
    log.error('Failed to close window:', error);
  }
};

// Update maximize button icon based on window state
const updateMaximizeIcon = (isMaximized: boolean) => {
  // This could be used to change the icon between maximize and restore
  log.debug('Window maximized state:', isMaximized);
};

// Link button handlers
const openGitHub = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://github.com/bit-admin/Yanhekt-AutoSlides');
  } catch (error) {
    log.error('Failed to open GitHub repository:', error);
  }
};

const openITCenter = async () => {
  try {
    await (window as any).electronAPI.shell.openExternal('https://it.ruc.edu.kg/zh/software');
  } catch (error) {
    log.error('Failed to open User Manual:', error);
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
    log.error('Failed to reload:', error);
  }
};

const menuForceReload = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.forceReload();
  } catch (error) {
    log.error('Failed to force reload:', error);
  }
};

const menuToggleDevTools = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.toggleDevTools();
  } catch (error) {
    log.error('Failed to toggle dev tools:', error);
  }
};

const menuResetZoom = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.resetZoom();
  } catch (error) {
    log.error('Failed to reset zoom:', error);
  }
};

const menuZoomIn = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.zoomIn();
  } catch (error) {
    log.error('Failed to zoom in:', error);
  }
};

const menuZoomOut = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.zoomOut();
  } catch (error) {
    log.error('Failed to zoom out:', error);
  }
};

const menuToggleFullscreen = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.toggleFullscreen();
  } catch (error) {
    log.error('Failed to toggle fullscreen:', error);
  }
};

const openTermsAndConditions = async () => {
  closeAllMenus();
  try {
    await (window as any).electronAPI.menu.openTermsAndConditions();
  } catch (error) {
    log.error('Failed to open Terms and Conditions:', error);
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
    log.error('Failed to show about dialog:', error);
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

/* Demo mode (macOS vibrancy disabled for clean captures): the transparent left
   segment would read as white, so paint it the opaque sidebar gray — same split
   as the non-macOS rule below. */
html.platform-darwin.demo-mode .titlebar.is-macos {
  background:
    linear-gradient(var(--border-color), var(--border-color))
      right bottom / calc(100% - var(--left-panel-width)) 1px no-repeat,
    linear-gradient(to right,
      var(--bg-page-alt) calc(var(--left-panel-width) - 1px),
      var(--border-color) calc(var(--left-panel-width) - 1px),
      var(--border-color) var(--left-panel-width),
      var(--bg-elevated) var(--left-panel-width))
      left top / 100% 100% no-repeat;
}

/* Non-macOS (Windows/Linux): the sidebar's gray surface continues up into the
   left segment of the title bar so the sidebar appears to reach the top of the
   window (the menu bar sits on this gray). Same split mechanism as macOS — the
   only difference is the left segment is opaque --bg-page-alt instead of the
   transparent vibrancy. Split at --left-panel-width (reactive var from App.vue):
   gray | 1px vertical hairline | opaque bar. Bottom hairline spans only the
   opaque right segment so the gray flows seamlessly into the panel below. */
.titlebar:not(.is-macos) {
  border-bottom: none;
  background:
    linear-gradient(var(--border-color), var(--border-color))
      right bottom / calc(100% - var(--left-panel-width)) 1px no-repeat,
    linear-gradient(to right,
      var(--bg-page-alt) calc(var(--left-panel-width) - 1px),
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

/* Leading / trailing flex clusters that wrap the platform controls plus the
   collapse toggles. Measured via ResizeObserver to publish the reserve vars. */
.titlebar-lead,
.titlebar-trail {
  display: flex;
  align-items: center;
  height: 100%;
  flex-shrink: 0;
}

/* macOS: nudge the trailing toggle off the right window edge (no window
   controls there to provide spacing). */
.titlebar.is-macos .titlebar-trail {
  padding-right: 6px;
}

/* Panel collapse toggles (sidebar + task panel). */
.panel-toggle {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 26px;
  margin: 0 2px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.panel-toggle:hover {
  background-color: var(--bg-hover);
  color: var(--text-secondary);
}

/* macOS: the traffic lights sit a touch below the title-bar centerline, so nudge
   the toggles down to line up with them (Safari/Finder alignment). */
.titlebar.is-macos .panel-toggle {
  transform: translateY(1px);
}

/* Non-macOS: collapse toggles live inside the center drag band (the tab strip).
   They opt out of dragging and align with the tab chips. */
.panel-toggle--center {
  flex-shrink: 0;
}

/* Push the right-panel toggle to the trailing edge of the strip. */
.panel-toggle--center-trail {
  margin-left: auto;
}

/* Highlight when the matching panel is collapsed. */
.panel-toggle.active {
  color: var(--accent);
}

.panel-toggle svg {
  pointer-events: none;
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

/* Tab strip — spans the main-content segment (left panel edge → right panel
   edge), positioned with the reactive panel-width vars from App.vue. The strip
   background stays draggable; individual chips are no-drag so they remain
   clickable (Chrome/Arc pattern). Tabs that don't fit collapse into the "···"
   overflow dropdown (see .tab-overflow) — the strip itself never scrolls. */
.tab-strip {
  position: absolute;
  top: 0;
  bottom: 0;
  /* Clamp to the leading/trailing control clusters so the strip never slides
     under the traffic lights / menu bar / toggles / window controls when a
     panel collapses (panel-width → 0). When expanded the panel width exceeds
     the reserve, so max() is a no-op and layout is unchanged. */
  left: max(var(--left-panel-width), var(--lead-reserve, 0px));
  right: max(var(--right-panel-width), var(--trail-reserve, 0px));
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  overflow: hidden;
  -webkit-app-region: drag;
}

.tab-chip {
  -webkit-app-region: no-drag;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  max-width: 220px;
  padding: 0 6px 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.tab-chip--info {
  padding: 0 10px;
}

.tab-chip:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.tab-chip.active {
  background-color: var(--focus-ring);
  color: var(--accent);
}

.tab-chip svg {
  flex-shrink: 0;
}

.tab-chip-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tab-chip-dot.mode-live {
  background-color: var(--danger);
}

.tab-chip-dot.mode-recorded {
  background-color: var(--accent);
}

.tab-chip-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 4px;
  font-size: 15px;
  line-height: 1;
  color: var(--text-muted);
  flex-shrink: 0;
}

.tab-chip-close:hover {
  background-color: var(--bg-subtle);
  color: var(--text-primary);
}

/* Task tabs can't be closed while the task is running (mirrors the disabled
   Back button in the PlaybackPage). */
.tab-chip-close.disabled {
  opacity: 0.35;
  cursor: default;
  pointer-events: none;
}

/* Overflow ("···") — collapses tabs that don't fit into a dropdown. */
.tab-overflow {
  position: relative;
  -webkit-app-region: no-drag;
  flex-shrink: 0;
}

.tab-overflow-btn {
  max-width: none;
  padding: 0 8px;
  gap: 4px;
}

.tab-overflow-count {
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

/* Teleported to <body>: fixed-positioned via inline top/right from the button.
   z-index sits above the title bar (z-index:1000) so it's never clipped. */
.tab-overflow-menu {
  position: fixed;
  min-width: 200px;
  max-width: 280px;
  max-height: 320px;
  overflow-y: auto;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: var(--shadow-md);
  padding: 4px;
  z-index: var(--z-super-modal);
  -webkit-app-region: no-drag;
}

.tab-overflow-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: 30px;
  padding: 0 6px 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.tab-overflow-item:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

.tab-overflow-item.active {
  background-color: var(--focus-ring);
  color: var(--accent);
}

.tab-overflow-item-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Right-panel view switcher — compact icon+text tabs left-aligned at the right
   panel's left edge (mirrors how the menu/title sits in the left segment). The
   left edge is pinned via the reactive --right-panel-width var from App.vue;
   absolute positioning keeps it out of the flex flow so the drag region and
   window controls keep their layout. On Windows the right edge is inset by the
   window-controls width so the tabs never overlap min/max/close. */
.view-switcher {
  position: absolute;
  top: 0;
  bottom: 0;
  left: calc(100% - var(--right-panel-width));
  /* Inset by the trailing cluster (right toggle on macOS; right toggle + the
     three window controls on Win-Linux) so the switcher never overlaps them. */
  right: var(--trail-reserve, 0px);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 2px;
  padding: 0 8px;
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.view-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-tab:hover {
  background-color: var(--bg-hover);
  color: var(--text-primary);
}

/* Active state matches the Tools window tabs (.toolwin-tab.active) */
.view-tab.active {
  background-color: var(--focus-ring);
  color: var(--accent);
}

.view-tab svg {
  flex-shrink: 0;
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