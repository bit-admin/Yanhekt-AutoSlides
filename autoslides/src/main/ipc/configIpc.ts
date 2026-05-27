import { ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { IpcServices } from './types';
import type { AIServiceType } from '@main/platform/configService';

export function registerConfigIpcHandlers(services: IpcServices): void {
  const {
    configService,
    intranetMappingService,
    powerManagementService,
    llmApiService,
    aiPromptsService,
    windowManager
  } = services;

  ipcMain.handle('config:get', async () => {
    return configService.getConfig();
  });

  ipcMain.handle('config:setOutputDirectory', async (_event, directory: string) => {
    configService.setOutputDirectory(directory);
    return configService.getConfig();
  });

  ipcMain.handle('config:selectOutputDirectory', async () => {
    const selectedPath = await configService.selectOutputDirectory();
    return selectedPath ? configService.getConfig() : null;
  });

  ipcMain.handle('config:setConnectionMode', async (_event, mode: 'internal' | 'external') => {
    configService.setConnectionMode(mode);
    intranetMappingService.setEnabled(mode === 'internal');
    return configService.getConfig();
  });

  ipcMain.handle('config:setMaxConcurrentDownloads', async (_event, count: number) => {
    configService.setMaxConcurrentDownloads(count);
    return configService.getConfig();
  });

  ipcMain.handle('config:setDownloadMaxWorkers', async (_event, count: number) => {
    configService.setDownloadMaxWorkers(count);
    return configService.getConfig();
  });

  ipcMain.handle('config:setDownloadNumRetries', async (_event, count: number) => {
    configService.setDownloadNumRetries(count);
    return configService.getConfig();
  });

  ipcMain.handle('config:setMuteMode', async (_event, mode: 'normal' | 'mute_all' | 'mute_live' | 'mute_recorded') => {
    configService.setMuteMode(mode);
    return configService.getConfig();
  });

  ipcMain.handle('config:setVideoRetryCount', async (_event, count: number) => {
    configService.setVideoRetryCount(count);
    return configService.getConfig();
  });

  ipcMain.handle('config:setTaskSpeed', async (_event, speed: number) => {
    configService.setTaskSpeed(speed);
    return configService.getConfig();
  });

  ipcMain.handle('config:setShowMorePlaybackSpeed', async (_event, enabled: boolean) => {
    configService.setShowMorePlaybackSpeed(enabled);
    return configService.getConfig();
  });

  ipcMain.handle('config:setAutoPostProcessing', async (_event, enabled: boolean) => {
    configService.setAutoPostProcessing(enabled);
    return configService.getConfig();
  });

  ipcMain.handle('config:setAutoPostProcessingLive', async (_event, enabled: boolean) => {
    configService.setAutoPostProcessingLive(enabled);
    return configService.getConfig();
  });

  ipcMain.handle('config:getAutoPostProcessingLive', async () => {
    return configService.getAutoPostProcessingLive();
  });

  ipcMain.handle('config:setEnableAIFiltering', async (_event, enabled: boolean) => {
    configService.setEnableAIFiltering(enabled);
    return configService.getConfig();
  });

  ipcMain.handle('config:getEnableAIFiltering', async () => {
    return configService.getEnableAIFiltering();
  });

  ipcMain.handle('config:setDistinguishMaybeSlide', async (_event, enabled: boolean) => {
    configService.setDistinguishMaybeSlide(enabled);
    return configService.getConfig();
  });

  ipcMain.handle('config:getDistinguishMaybeSlide', async () => {
    return configService.getDistinguishMaybeSlide();
  });

  ipcMain.handle('config:setAutoCropParams', async (_event, params) => {
    configService.setAutoCropParams(params);
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:resetAutoCropParams', async () => {
    return configService.resetAutoCropParams();
  });

  ipcMain.handle('config:setAutoCropDetectorMode', async (_event, mode) => {
    configService.setAutoCropDetectorMode(mode);
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:setAutoCropYoloParams', async (_event, params) => {
    configService.setAutoCropYoloParams(params);
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:resetAutoCropYoloParams', async () => {
    return configService.resetAutoCropYoloParams();
  });

  ipcMain.handle('config:setThemeMode', async (_event, theme: 'system' | 'light' | 'dark') => {
    configService.setThemeMode(theme);
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
    return configService.getConfig();
  });

  ipcMain.handle('config:setAuthToken', async (_event, token: string | null) => {
    configService.setAuthToken(token);
  });

  ipcMain.handle('config:getAuthToken', async () => {
    return configService.getAuthToken();
  });

  ipcMain.handle('config:getSkipUpdateCheckUntil', async () => {
    return configService.getSkipUpdateCheckUntil();
  });

  ipcMain.handle('config:setSkipUpdateCheckUntil', async (_event, timestamp: number) => {
    configService.setSkipUpdateCheckUntil(timestamp);
  });

  ipcMain.handle('config:setUserNames', async (_event, original: string, display: string) => {
    configService.setUserNames(original, display);
  });

  ipcMain.handle('config:setLastGreetingId', async (_, id: string) => {
    configService.setLastGreetingId(id);
  });

  ipcMain.handle('config:setSavedSearches', async (_, mode: 'live' | 'recorded', searches: string[]) => {
    configService.setSavedSearches(mode, searches);
  });

  ipcMain.handle('config:getSlideExtractionConfig', async () => {
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:setSlideCheckInterval', async (_event, interval: number) => {
    configService.setSlideCheckInterval(interval);
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:setSlideDoubleVerification', async (_event, enabled: boolean, count?: number) => {
    configService.setSlideDoubleVerification(enabled, count);
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
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:setSlideExtractionConfig', async (_event, config: {
    enableDuplicateRemoval?: boolean;
    enableExclusionList?: boolean;
  }) => {
    configService.setSlideExtractionConfig(config);
    return configService.getSlideExtractionConfig();
  });

  ipcMain.handle('config:getPHashExclusionList', async () => {
    return configService.getPHashExclusionList();
  });

  ipcMain.handle('config:addPHashExclusionItem', async (_event, name: string, pHash: string) => {
    return configService.addPHashExclusionItem(name, pHash);
  });

  ipcMain.handle('config:removePHashExclusionItem', async (_event, id: string) => {
    return configService.removePHashExclusionItem(id);
  });

  ipcMain.handle('config:updatePHashExclusionItemName', async (_event, id: string, newName: string) => {
    return configService.updatePHashExclusionItemName(id, newName);
  });

  ipcMain.handle('config:clearPHashExclusionList', async () => {
    configService.clearPHashExclusionList();
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
      console.error('Failed to select image for exclusion:', error);
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
    return next;
  });

  ipcMain.handle('config:setAIBatchSize', async (_event, batchSize: number) => {
    configService.setAIBatchSize(batchSize);
    return configService.getAIFilteringConfig();
  });

  ipcMain.handle('config:getAIBatchSize', async () => {
    return configService.getAIBatchSize();
  });

  ipcMain.handle('config:setAIClassifierMode', async (_event, mode: 'llm' | 'ml') => {
    configService.setAIClassifierMode(mode);
    return configService.getAIFilteringConfig();
  });

  ipcMain.handle(
    'config:setMlThresholds',
    async (_event, thresholds: { trustLow?: number; trustHigh?: number; slideCheckLow?: number }) => {
      configService.setMlThresholds(thresholds);
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
