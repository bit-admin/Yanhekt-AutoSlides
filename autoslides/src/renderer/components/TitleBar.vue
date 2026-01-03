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

    <!-- Update Modal -->
    <div v-if="showUpdateModal" class="modal-overlay" @click="closeUpdateModal">
      <div class="modal-content update-modal" @click.stop>
        <div class="modal-header">
          <h3>{{ $t('titlebar.updateModal.title') }}</h3>
          <button @click="closeUpdateModal" class="close-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <!-- Version Info -->
          <div class="version-header">
            <div class="version-badge">v{{ releaseInfo?.latestVersion }}</div>
            <div class="version-meta">
              <span class="current-version">{{ $t('titlebar.updateModal.currentVersion') }}: v{{ releaseInfo?.currentVersion }}</span>
              <span v-if="releaseInfo?.publishedAt" class="publish-date">{{ formatDate(releaseInfo.publishedAt) }}</span>
            </div>
          </div>

          <!-- Release Notes -->
          <div class="release-notes-section">
            <h4>{{ $t('titlebar.updateModal.releaseNotes') }}</h4>
            <div class="release-notes-scroll" @click="handleReleaseNotesClick">
              <div class="markdown-body" v-html="releaseInfo?.releaseBody || $t('titlebar.updateModal.noReleaseNotes')"></div>
            </div>
          </div>

          <!-- Download Section -->
          <div class="download-section">
            <!-- Download Buttons -->
            <div v-if="!isDownloading && !downloadedFile" class="download-assets">
              <div v-for="asset in releaseInfo?.assets" :key="asset.name" class="asset-item">
                <div class="asset-info">
                  <span class="asset-name">{{ asset.name }}</span>
                  <span class="asset-size">{{ asset.formattedSize }}</span>
                </div>
                <div class="asset-actions">
                  <button class="download-btn" @click="startDownload(asset.url, asset.name)">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    {{ $t('titlebar.updateModal.downloadFromGitHub') }}
                  </button>
                  <button class="download-btn secondary" @click="startDownload(asset.proxyUrl, asset.name)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7,10 12,15 17,10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    {{ $t('titlebar.updateModal.downloadWithProxy') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Download Progress -->
            <div v-if="isDownloading" class="download-progress-section">
              <div class="progress-header">
                <span class="progress-label">{{ $t('titlebar.updateModal.downloading') }}</span>
                <span class="progress-percent">{{ downloadProgress.percent }}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: downloadProgress.percent + '%' }"></div>
              </div>
              <div class="progress-footer">
                <span class="progress-bytes">{{ formatBytes(downloadProgress.downloaded) }} / {{ formatBytes(downloadProgress.total) }}</span>
                <button class="cancel-download-btn" @click="cancelDownload">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                  {{ $t('titlebar.updateModal.cancelDownload') }}
                </button>
              </div>
            </div>

            <!-- Download Complete -->
            <div v-if="downloadedFile && !isDownloading" class="download-complete-section">
              <div class="complete-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
                <span>{{ $t('titlebar.updateModal.downloadComplete') }}</span>
              </div>
              <div class="complete-actions">
                <button class="action-btn" @click="openDownloadFolder">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {{ $t('titlebar.updateModal.openDownloadFolder') }}
                </button>
                <button class="action-btn primary" @click="installUpdate">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {{ $t('titlebar.updateModal.installUpdate') }}
                </button>
              </div>

              <!-- macOS Quarantine Notice -->
              <div v-if="isMacOS" class="quarantine-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                <div class="notice-text">
                  <span>{{ $t('titlebar.updateModal.macQuarantineNotice') }}</span>
                  <div class="code-with-copy">
                    <code>sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app</code>
                    <button class="copy-btn" @click="copyQuarantineCommand" :title="$t('titlebar.copy')">
                      <svg v-if="!commandCopied" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-actions">
          <button v-if="isAutoCheck" class="cancel-btn" @click="skipFor7Days">{{ $t('titlebar.skipFor7Days') }}</button>
          <button class="save-btn" @click="closeUpdateModal">
            {{ isAutoCheck ? $t('titlebar.remindMeLater') : $t('titlebar.updateModal.close') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { useTour } from '../composables/useTour';
import '../assets/github-markdown.css';

// Types
interface ReleaseAsset {
  name: string;
  url: string;
  size: number;
  formattedSize: string;
  proxyUrl: string;
}

interface ReleaseInfo {
  success: boolean;
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseBody: string;
  publishedAt: string;
  assets: ReleaseAsset[];
}

interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
}

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

// Update modal state
const showUpdateModal = ref(false);
const releaseInfo = ref<ReleaseInfo | null>(null);
const isDownloading = ref(false);
const downloadedFile = ref<string | null>(null);
const downloadProgress = ref<DownloadProgress>({ downloaded: 0, total: 0, percent: 0 });
const isAutoCheck = ref(false);  // Track if modal was opened from auto-check
const commandCopied = ref(false);  // Track if quarantine command was copied

// Cleanup functions for event listeners
let cleanupDownloadProgress: (() => void) | null = null;
let cleanupDownloadComplete: (() => void) | null = null;
let cleanupDownloadError: (() => void) | null = null;
let cleanupPromptQuit: (() => void) | null = null;

onMounted(() => {
  // Detect platform using userAgent as navigator.platform is deprecated
  isMacOS.value = navigator.userAgent.toLowerCase().includes('mac');

  // Add click listener to close menus when clicking outside
  document.addEventListener('click', handleOutsideClick);

  // Listen for check for updates event from macOS menu
  (window as any).electronAPI.update.onCheckForUpdates(() => {
    checkForUpdates();
  });

  // Listen for auto-check for updates event on app launch
  (window as any).electronAPI.update.onAutoCheckForUpdates(() => {
    autoCheckForUpdates();
  });

  // Set up download event listeners
  cleanupDownloadProgress = (window as any).electronAPI.update.onDownloadProgress((progress: DownloadProgress) => {
    downloadProgress.value = progress;
  });

  cleanupDownloadComplete = (window as any).electronAPI.update.onDownloadComplete((filename: string) => {
    downloadedFile.value = filename;
    isDownloading.value = false;
  });

  cleanupDownloadError = (window as any).electronAPI.update.onDownloadError((error: string) => {
    isDownloading.value = false;
    console.error('Download error:', error);
    (window as any).electronAPI.dialog.showMessageBox({
      type: 'error',
      title: $t('titlebar.updateModal.downloadFailed'),
      message: error,
      buttons: [$t('titlebar.ok')]
    });
  });

  cleanupPromptQuit = (window as any).electronAPI.update.onPromptQuit(() => {
    promptQuitAndInstall();
  });
});

onUnmounted(() => {
  document.removeEventListener('click', handleOutsideClick);
  // Clean up event listeners
  if (cleanupDownloadProgress) cleanupDownloadProgress();
  if (cleanupDownloadComplete) cleanupDownloadComplete();
  if (cleanupDownloadError) cleanupDownloadError();
  if (cleanupPromptQuit) cleanupPromptQuit();
});

// Utility functions
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// Update modal functions
const openUpdateModal = (fromAutoCheck = false) => {
  isAutoCheck.value = fromAutoCheck;
  showUpdateModal.value = true;
};

const closeUpdateModal = () => {
  showUpdateModal.value = false;
  isAutoCheck.value = false;
  commandCopied.value = false;
  // Reset download state when closing
  if (!isDownloading.value) {
    downloadedFile.value = null;
    downloadProgress.value = { downloaded: 0, total: 0, percent: 0 };
  }
};

const skipFor7Days = async () => {
  const skipUntilTimestamp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  await (window as any).electronAPI.config.setSkipUpdateCheckUntil(skipUntilTimestamp);
  closeUpdateModal();
};

// Handle clicks in release notes - prevent link navigation
const handleReleaseNotesClick = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  const link = target.closest('a');
  if (link) {
    event.preventDefault();
    event.stopPropagation();
    const href = link.getAttribute('href');
    if (href) {
      (window as any).electronAPI.shell.openExternal(href);
    }
  }
};

// Copy quarantine command to clipboard
const copyQuarantineCommand = () => {
  navigator.clipboard.writeText('sudo xattr -d com.apple.quarantine /Applications/AutoSlides.app');
  commandCopied.value = true;
  setTimeout(() => {
    commandCopied.value = false;
  }, 2000);
};

const startDownload = async (url: string, filename: string) => {
  isDownloading.value = true;
  downloadedFile.value = null;
  downloadProgress.value = { downloaded: 0, total: 0, percent: 0 };

  try {
    await (window as any).electronAPI.update.downloadUpdate(url, filename);
  } catch (error) {
    console.error('Failed to start download:', error);
    isDownloading.value = false;
  }
};

const cancelDownload = async () => {
  try {
    await (window as any).electronAPI.update.cancelDownload();
    isDownloading.value = false;
    downloadProgress.value = { downloaded: 0, total: 0, percent: 0 };
  } catch (error) {
    console.error('Failed to cancel download:', error);
  }
};

const openDownloadFolder = async () => {
  try {
    await (window as any).electronAPI.update.openDownloadFolder();
  } catch (error) {
    console.error('Failed to open download folder:', error);
  }
};

const installUpdate = async () => {
  if (!downloadedFile.value) return;

  try {
    await (window as any).electronAPI.update.installUpdate(downloadedFile.value);
    // The promptQuit event will be sent from main process for macOS/Windows
  } catch (error) {
    console.error('Failed to install update:', error);
  }
};

const promptQuitAndInstall = async () => {
  const response = await (window as any).electronAPI.dialog.showMessageBox({
    type: 'question',
    title: $t('titlebar.updateModal.confirmQuit'),
    message: $t('titlebar.updateModal.confirmQuitMessage'),
    buttons: [$t('titlebar.updateModal.quit'), $t('titlebar.updateModal.later')],
    defaultId: 0,
    cancelId: 1
  });

  if (response.response === 0) {
    // User clicked "Quit and Install"
    await (window as any).electronAPI.window.close();
  }
};

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
        buttons: [$t('titlebar.ok')],
        defaultId: 0,
        cancelId: 0
      });
      return;
    }

    if (result.hasUpdate) {
      // Update available - open the update modal
      releaseInfo.value = result;
      downloadedFile.value = null;
      downloadProgress.value = { downloaded: 0, total: 0, percent: 0 };
      isDownloading.value = false;
      openUpdateModal();
    } else {
      // No update available
      await (window as any).electronAPI.dialog.showMessageBox({
        type: 'info',
        title: $t('titlebar.noUpdateAvailable'),
        message: $t('titlebar.noUpdateMessage'),
        detail: $t('titlebar.noUpdateDetail', { currentVersion: result.currentVersion }),
        buttons: [$t('titlebar.ok')],
        defaultId: 0,
        cancelId: 0
      });
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
};

// Auto-check for updates on app launch (silent errors, skip option)
const autoCheckForUpdates = async () => {
  try {
    // Check if user has chosen to skip update checks
    const skipUntil = await (window as any).electronAPI.config.getSkipUpdateCheckUntil();
    if (Date.now() < skipUntil) {
      return; // Skip this check
    }

    // Check for old update files first
    const oldFilesResult = await (window as any).electronAPI.update.findOldUpdates();
    if (oldFilesResult.success && oldFilesResult.files && oldFilesResult.files.length > 0) {
      const response = await (window as any).electronAPI.dialog.showMessageBox({
        type: 'question',
        title: $t('titlebar.updateModal.oldFilesFound'),
        message: $t('titlebar.updateModal.oldFilesMessage', { count: oldFilesResult.files.length }),
        buttons: [$t('titlebar.updateModal.deleteOldFiles'), $t('titlebar.updateModal.keepOldFiles')],
        defaultId: 0,
        cancelId: 1
      });

      if (response.response === 0) {
        // User clicked "Delete"
        await (window as any).electronAPI.update.deleteOldUpdates(oldFilesResult.files);
      }
    }

    const result = await (window as any).electronAPI.update.checkForUpdates();

    // Silently ignore errors and no-update cases
    if (!result.success || !result.hasUpdate) {
      return;
    }

    // Update available - open modal directly with auto-check flag
    releaseInfo.value = result;
    downloadedFile.value = null;
    downloadProgress.value = { downloaded: 0, total: 0, percent: 0 };
    isDownloading.value = false;
    openUpdateModal(true);  // true = from auto-check, show skip/remind buttons
  } catch {
    // Silently ignore all errors
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

/* Update Modal Styles - matching LeftPanel.vue patterns */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.modal-content {
  background-color: white;
  border-radius: 8px;
  width: 560px;
  max-width: 90vw;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e0e0e0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: #666;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background-color: #f8f9fa;
}

.modal-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding: 16px;
  color: #333;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  flex-shrink: 0;
}

.cancel-btn, .save-btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background-color: #f8f9fa;
  color: #666;
}

.cancel-btn:hover {
  background-color: #e9ecef;
  border-color: #adb5bd;
}

.save-btn {
  background-color: #007acc;
  color: white;
  border-color: #007acc;
}

.save-btn:hover {
  background-color: #0056b3;
  border-color: #0056b3;
}

/* Version header */
.version-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.version-badge {
  background: #007acc;
  color: white;
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 600;
}

.version-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.current-version {
  font-size: 12px;
  color: #666;
}

.publish-date {
  font-size: 11px;
  color: #999;
}

/* Release notes section */
.release-notes-section {
  margin-bottom: 16px;
}

.release-notes-section h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.release-notes-scroll {
  max-height: 180px;
  overflow-y: auto;
  padding: 12px;
  background: #f6f8fa;
  border-radius: 6px;
  font-size: 13px;
}

/* Download section */
.download-section {
  margin-top: auto;
}

.download-assets {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.asset-item {
  padding: 10px 12px;
  background: #f6f8fa;
  border-radius: 6px;
}

.asset-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.asset-name {
  font-size: 12px;
  color: #333;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-size {
  font-size: 11px;
  color: #666;
  flex-shrink: 0;
  margin-left: 8px;
}

.asset-actions {
  display: flex;
  gap: 8px;
}

.download-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  background: #24292e;
  color: white;
}

.download-btn:hover {
  background: #1a1e22;
}

.download-btn.secondary {
  background: #007acc;
}

.download-btn.secondary:hover {
  background: #0068b3;
}

.download-btn svg {
  flex-shrink: 0;
}

/* Download progress - matching RightPanel.vue */
.download-progress-section {
  padding: 12px;
  background: #f6f8fa;
  border-radius: 6px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label {
  font-size: 12px;
  color: #333;
  font-weight: 500;
}

.progress-percent {
  font-size: 12px;
  color: #007acc;
  font-weight: 600;
}

.progress-bar {
  width: 100%;
  height: 4px;
  background-color: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background-color: #007acc;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.progress-bytes {
  font-size: 11px;
  color: #666;
}

.cancel-download-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: transparent;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 11px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-download-btn:hover {
  background: #f0f0f0;
  border-color: #ccc;
}

/* Download complete */
.download-complete-section {
  padding: 12px;
  background: #f0fff4;
  border: 1px solid #86efac;
  border-radius: 6px;
}

.complete-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 13px;
  font-weight: 500;
  color: #16a34a;
}

.complete-badge svg {
  color: #16a34a;
}

.complete-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f6f8fa;
  border-color: #ccc;
}

.action-btn.primary {
  background: #007acc;
  border-color: #007acc;
  color: white;
}

.action-btn.primary:hover {
  background: #0068b3;
  border-color: #0068b3;
}

/* Quarantine notice */
.quarantine-notice {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: #fef9e7;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  margin-top: 12px;
}

.quarantine-notice > svg {
  color: #ca8a04;
  flex-shrink: 0;
  margin-top: 1px;
}

.notice-text {
  flex: 1;
  font-size: 11px;
  color: #854d0e;
  line-height: 1.4;
}

.code-with-copy {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.notice-text code {
  flex: 1;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 4px;
  font-size: 10px;
  font-family: ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, monospace;
  color: #713f12;
  word-break: break-all;
}

.copy-btn {
  flex-shrink: 0;
  padding: 4px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: #854d0e;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.5);
  color: #713f12;
}

.copy-btn:active {
  transform: scale(0.95);
}

/* Dark mode for update modal */
@media (prefers-color-scheme: dark) {
  .modal-overlay {
    background-color: rgba(0, 0, 0, 0.7);
  }

  .modal-content {
    background-color: #2d2d2d;
  }

  .modal-header {
    border-bottom-color: #404040;
  }

  .modal-header h3 {
    color: #e0e0e0;
  }

  .close-btn {
    color: #e0e0e0;
  }

  .close-btn:hover {
    background-color: #3d3d3d;
  }

  .modal-body {
    color: #e0e0e0;
  }

  .modal-actions {
    background-color: #2d2d2d;
    border-top-color: #404040;
  }

  .cancel-btn {
    background-color: #2d2d2d;
    color: #b0b0b0;
    border-color: #404040;
  }

  .cancel-btn:hover {
    background-color: #3d3d3d;
    border-color: #555;
  }

  .save-btn {
    background-color: #4a9eff;
    border-color: #4a9eff;
  }

  .save-btn:hover {
    background-color: #3a8eef;
    border-color: #3a8eef;
  }

  .version-badge {
    background: #4a9eff;
  }

  .current-version {
    color: #aaa;
  }

  .publish-date {
    color: #888;
  }

  .release-notes-section h4 {
    color: #e0e0e0;
  }

  .release-notes-scroll {
    background: #1e1e1e;
  }

  .asset-item {
    background: #1e1e1e;
  }

  .asset-name {
    color: #e0e0e0;
  }

  .asset-size {
    color: #aaa;
  }

  .download-btn {
    background: #3d3d3d;
  }

  .download-btn:hover {
    background: #4d4d4d;
  }

  .download-btn.secondary {
    background: #4a9eff;
  }

  .download-btn.secondary:hover {
    background: #3a8eef;
  }

  .download-progress-section {
    background: #1e1e1e;
  }

  .progress-label {
    color: #e0e0e0;
  }

  .progress-percent {
    color: #4fc3f7;
  }

  .progress-bar {
    background-color: #404040;
  }

  .progress-fill {
    background-color: #4fc3f7;
  }

  .progress-bytes {
    color: #aaa;
  }

  .cancel-download-btn {
    border-color: #555;
    color: #aaa;
  }

  .cancel-download-btn:hover {
    background: #404040;
    border-color: #666;
  }

  .download-complete-section {
    background: #1a3a2a;
    border-color: #2d8a56;
  }

  .complete-badge {
    color: #4ade80;
  }

  .complete-badge svg {
    color: #4ade80;
  }

  .action-btn {
    background: #3d3d3d;
    border-color: #555;
    color: #e0e0e0;
  }

  .action-btn:hover {
    background: #4d4d4d;
    border-color: #666;
  }

  .action-btn.primary {
    background: #4a9eff;
    border-color: #4a9eff;
  }

  .action-btn.primary:hover {
    background: #3a8eef;
    border-color: #3a8eef;
  }

  .quarantine-notice {
    background: #3d2f0d;
    border-color: #d97706;
  }

  .quarantine-notice > svg {
    color: #fbbf24;
  }

  .notice-text {
    color: #fcd34d;
  }

  .notice-text code {
    background: rgba(0, 0, 0, 0.3);
    color: #fde68a;
  }

  .copy-btn {
    background: transparent;
    color: #fcd34d;
  }

  .copy-btn:hover {
    background: rgba(0, 0, 0, 0.3);
    color: #fde68a;
  }
}
</style>