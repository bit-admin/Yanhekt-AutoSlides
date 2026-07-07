import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { IpcServices } from './types';
import type { AIServiceType } from '@main/platform/configService';
import type { PinnedCourse, StoredAccount } from '@common/types';
import { createLogger } from '@main/infra/logger';
const log = createLogger('ConfigIpc');

export function registerConfigIpcHandlers(services: IpcServices): void {
  const {
    configService,
    intranetMappingService,
    powerManagementService,
    llmApiService,
    aiPromptsService,
    windowManager
  } = services;

  // Push the current AppConfig snapshot to every live BrowserWindow. The
  // renderer-side configStore listens for 'config:onUpdate' and merges the
  // payload into its reactive state, so any consumer that reads configStore
  // sees the new values within one event-loop tick of a setter completing.
  const broadcastConfig = (): void => {
    const cfg = configService.getConfig();
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) {
        w.webContents.send('config:onUpdate', cfg);
      }
    }
  };

  ipcMain.handle('config:get', async () => {
    return configService.getConfig();
  });

  ipcMain.handle('config:setOutputDirectory', async (_event, directory: string) => {
    configService.setOutputDirectory(directory);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:selectOutputDirectory', async () => {
    const selectedPath = await configService.selectOutputDirectory();
    if (!selectedPath) return null;
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setConnectionMode', async (_event, mode: 'internal' | 'external') => {
    configService.setConnectionMode(mode);
    intranetMappingService.setEnabled(mode === 'internal');
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setMaxConcurrentDownloads', async (_event, count: number) => {
    configService.setMaxConcurrentDownloads(count);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setDownloadMaxWorkers', async (_event, count: number) => {
    configService.setDownloadMaxWorkers(count);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setDownloadNumRetries', async (_event, count: number) => {
    configService.setDownloadNumRetries(count);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setMuteMode', async (_event, mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => {
    configService.setMuteMode(mode);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setVideoRetryCount', async (_event, count: number) => {
    configService.setVideoRetryCount(count);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setVideoTokenRefreshSeconds', async (_event, seconds: number) => {
    configService.setVideoTokenRefreshSeconds(seconds);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setTaskSpeed', async (_event, speed: number) => {
    configService.setTaskSpeed(speed);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setParallelTasks', async (_event, count: number) => {
    configService.setParallelTasks(count);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setMaxManualTabs', async (_event, count: number) => {
    configService.setMaxManualTabs(count);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setPreviewFromVideo', async (_event, enabled: boolean) => {
    configService.setPreviewFromVideo(enabled);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setPreviewSeekSeconds', async (_event, seconds: number) => {
    configService.setPreviewSeekSeconds(seconds);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setShowMorePlaybackSpeed', async (_event, enabled: boolean) => {
    configService.setShowMorePlaybackSpeed(enabled);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setAutoPostProcessing', async (_event, enabled: boolean) => {
    configService.setAutoPostProcessing(enabled);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setAutoPostProcessingLive', async (_event, enabled: boolean) => {
    configService.setAutoPostProcessingLive(enabled);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:getAutoPostProcessingLive', async () => {
    return configService.getAutoPostProcessingLive();
  });

  ipcMain.handle('config:setEnableAIFiltering', async (_event, enabled: boolean) => {
    configService.setEnableAIFiltering(enabled);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:getEnableAIFiltering', async () => {
    return configService.getEnableAIFiltering();
  });

  ipcMain.handle('config:setDistinguishMaybeSlide', async (_event, enabled: boolean) => {
    configService.setDistinguishMaybeSlide(enabled);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:getDistinguishMaybeSlide', async () => {
    return configService.getDistinguishMaybeSlide();
  });

  ipcMain.handle('config:setAutoCropParams', async (_event, params) => {
    configService.setAutoCropParams(params);
    broadcastConfig();
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:resetAutoCropParams', async () => {
    const result = configService.resetAutoCropParams();
    broadcastConfig();
    return result;
  });

  ipcMain.handle('config:setAutoCropDetectorMode', async (_event, mode) => {
    configService.setAutoCropDetectorMode(mode);
    broadcastConfig();
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:setAutoCropYoloParams', async (_event, params) => {
    configService.setAutoCropYoloParams(params);
    broadcastConfig();
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:resetAutoCropYoloParams', async () => {
    const result = configService.resetAutoCropYoloParams();
    broadcastConfig();
    return result;
  });

  ipcMain.handle('config:setThemeMode', async (_event, theme: 'system' | 'light' | 'dark') => {
    configService.setThemeMode(theme);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:getThemeMode', async () => {
    return configService.getThemeMode();
  });

  ipcMain.handle('config:isDarkMode', async () => {
    return configService.isDarkMode();
  });

  ipcMain.handle('config:getEffectiveTheme', async () => {
    return configService.getEffectiveTheme();
  });

  ipcMain.handle('config:setLanguageMode', async (_event, language: 'system' | 'en' | 'zh') => {
    configService.setLanguageMode(language);
    windowManager.updateApplicationMenu();
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:getLanguageMode', async () => {
    return configService.getLanguageMode();
  });

  ipcMain.handle('config:setPreventSystemSleep', async (_event, prevent: boolean) => {
    configService.setPreventSystemSleep(prevent);
    if (prevent) {
      await powerManagementService.preventSleep();
    } else {
      await powerManagementService.allowSleep();
    }
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setAuthToken', async (_event, token: string | null) => {
    configService.setAuthToken(token);
    broadcastConfig();
  });

  ipcMain.handle('config:getAuthToken', async () => {
    return configService.getAuthToken();
  });

  ipcMain.handle('config:getSkipUpdateCheckUntil', async () => {
    return configService.getSkipUpdateCheckUntil();
  });

  ipcMain.handle('config:setSkipUpdateCheckUntil', async (_event, timestamp: number) => {
    configService.setSkipUpdateCheckUntil(timestamp);
    broadcastConfig();
  });

  ipcMain.handle('config:setUserNames', async (_event, original: string, display: string) => {
    configService.setUserNames(original, display);
    broadcastConfig();
  });

  ipcMain.handle('config:setLastGreetingId', async (_, id: string) => {
    configService.setLastGreetingId(id);
    broadcastConfig();
  });

  ipcMain.handle('config:setOnboardingCompleted', async (_, completed: boolean) => {
    configService.setOnboardingCompleted(completed);
    broadcastConfig();
  });

  ipcMain.handle('config:setCloudStorageInitialized', async (_, badge: string, initialized: boolean) => {
    configService.setCloudStorageInitialized(badge, initialized);
    broadcastConfig();
  });

  ipcMain.handle('config:setCloudAutoSyncMode', async (_, mode: 'disabled' | 'edited' | 'reviewed') => {
    configService.setCloudAutoSyncMode(mode);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:setCloudAutoPublishAfterSync', async (_, enabled: boolean) => {
    configService.setCloudAutoPublishAfterSync(enabled);
    broadcastConfig();
    return configService.getConfig();
  });

  ipcMain.handle('config:upsertAccount', async (_, account: StoredAccount) => {
    configService.upsertAccount(account);
    broadcastConfig();
  });

  ipcMain.handle('config:removeAccount', async (_, badge: string) => {
    configService.removeAccount(badge);
    broadcastConfig();
  });

  ipcMain.handle('config:setSavedSearches', async (_, mode: 'live' | 'recorded', searches: string[]) => {
    configService.setSavedSearches(mode, searches);
    broadcastConfig();
  });

  ipcMain.handle('config:setPinnedRecordedCourses', async (_, courses: PinnedCourse[]) => {
    configService.setPinnedRecordedCourses(courses);
    broadcastConfig();
  });

  ipcMain.handle('config:getSlideExtractionConfig', async () => {
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:setSlideCheckInterval', async (_event, interval: number) => {
    configService.setSlideCheckInterval(interval);
    broadcastConfig();
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:setSlideDoubleVerification', async (_event, enabled: boolean, count?: number) => {
    configService.setSlideDoubleVerification(enabled, count);
    broadcastConfig();
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:setSlideImageProcessingParams', async (_event, params: {
    ssimThreshold?: number;
    ssimPresetMode?: 'adaptive' | 'strict' | 'normal' | 'loose' | 'custom';
    pHashThreshold?: number;
    enableDownsampling?: boolean;
    downsampleWidth?: number;
    downsampleHeight?: number;
    enablePngColorReduction?: boolean;
  }) => {
    configService.setSlideImageProcessingParams(params);
    broadcastConfig();
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:setSlideExtractionConfig', async (_event, config: {
    enableDuplicateRemoval?: boolean;
    enableExclusionList?: boolean;
  }) => {
    configService.setSlideExtractionConfig(config);
    broadcastConfig();
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:getPHashExclusionList', async () => {
    return configService.getPHashExclusionList();
  });

  ipcMain.handle('config:addPHashExclusionItem', async (_event, name: string, pHash: string) => {
    const result = configService.addPHashExclusionItem(name, pHash);
    broadcastConfig();
    return result;
  });

  ipcMain.handle('config:removePHashExclusionItem', async (_event, id: string) => {
    const result = configService.removePHashExclusionItem(id);
    broadcastConfig();
    return result;
  });

  ipcMain.handle('config:updatePHashExclusionItemName', async (_event, id: string, newName: string) => {
    const result = configService.updatePHashExclusionItemName(id, newName);
    broadcastConfig();
    return result;
  });

  ipcMain.handle('config:clearPHashExclusionList', async () => {
    configService.clearPHashExclusionList();
    broadcastConfig();
    return configService.getPHashExclusionList();
  });

  ipcMain.handle('config:selectImageForExclusion', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif', 'webp'] }
        ],
        title: 'Select Image for Exclusion List'
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const imagePath = result.filePaths[0];
        const imageBuffer = fs.readFileSync(imagePath);
        return {
          success: true,
          imagePath,
          imageBuffer: Array.from(imageBuffer),
          fileName: path.basename(imagePath)
        };
      }

      return { success: false, canceled: true };
    } catch (error) {
      log.error('Failed to select image for exclusion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  ipcMain.handle('config:getAIFilteringConfig', async () => {
    return configService.getAIFilteringConfig();
  });

  ipcMain.handle('config:setAIFilteringConfig', async (_event, config: {
    serviceType?: AIServiceType;
    customApiBaseUrl?: string;
    customApiKey?: string;
    customModelName?: string;
    customModelChain?: string[];
    customProviderId?: 'modelscope' | 'lm_studio' | 'other';
    copilotGhoToken?: string;
    copilotModelName?: string;
    copilotUsername?: string;
    copilotAvatarUrl?: string;
    batchSize?: number;
    rateLimit?: number;
    imageResizeWidth?: number;
    imageResizeHeight?: number;
    maxConcurrent?: number;
    minTime?: number;
  }) => {
    const prev = configService.getAIFilteringConfig();
    configService.setAIFilteringConfig(config);
    const next = configService.getAIFilteringConfig();
    const chainChanged =
      config.customModelChain !== undefined &&
      JSON.stringify(prev.customModelChain) !== JSON.stringify(next.customModelChain);
    if (
      (config.customApiBaseUrl !== undefined && prev.customApiBaseUrl !== next.customApiBaseUrl) ||
      (config.customApiKey !== undefined && prev.customApiKey !== next.customApiKey) ||
      chainChanged
    ) {
      llmApiService.resetExhaustedModels();
    }
    if (
      config.rateLimit !== undefined ||
      config.maxConcurrent !== undefined ||
      config.minTime !== undefined
    ) {
      llmApiService.updateRateLimitConfig();
    }
    broadcastConfig();
    return next;
  });

  ipcMain.handle('config:setAIBatchSize', async (_event, batchSize: number) => {
    configService.setAIBatchSize(batchSize);
    broadcastConfig();
    return configService.getAIFilteringConfig();
  });

  ipcMain.handle('config:getAIBatchSize', async () => {
    return configService.getAIBatchSize();
  });

  ipcMain.handle('config:setAIClassifierMode', async (_event, mode: 'llm' | 'ml') => {
    configService.setAIClassifierMode(mode);
    broadcastConfig();
    return configService.getAIFilteringConfig();
  });

  ipcMain.handle(
    'config:setMlThresholds',
    async (_event, thresholds: { trustLow?: number; trustHigh?: number; slideCheckLow?: number }) => {
      configService.setMlThresholds(thresholds);
      broadcastConfig();
      return configService.getAIFilteringConfig();
    }
  );

  ipcMain.handle('config:getAIPrompts', async (_event, variant?: 'simple' | 'distinguish') => {
    return aiPromptsService.getPrompts(variant);
  });

  ipcMain.handle('config:getAIPrompt', async (_event, type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') => {
    return aiPromptsService.getPrompt(type, variant);
  });

  ipcMain.handle('config:setAIPrompt', async (_event, type: 'live' | 'recorded', prompt: string, variant?: 'simple' | 'distinguish') => {
    aiPromptsService.setPrompt(type, prompt, variant);
    return aiPromptsService.getPrompts(variant);
  });

  ipcMain.handle('config:resetAIPrompt', async (_event, type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') => {
    return aiPromptsService.resetPrompt(type, variant);
  });

  ipcMain.handle('config:getDefaultAIPrompt', async (_event, type: 'live' | 'recorded', variant?: 'simple' | 'distinguish') => {
    return aiPromptsService.getDefaultPrompt(type, variant);
  });
}
