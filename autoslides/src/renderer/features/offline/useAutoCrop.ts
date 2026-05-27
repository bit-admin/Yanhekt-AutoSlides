import { onUnmounted, ref } from 'vue';

import type { DetectorMode } from '@shared/workers/autoCrop.worker';
import { configStore } from '@shared/services/configStore'
import {
  createAutoCropWorkerClient,
  processBatch,
  type AutoCropBatchProgress,
  type AutoCropImageSource,
} from '@shared/autoCrop';

export interface AutoCropProgress extends AutoCropBatchProgress {
  phase: 'idle' | 'processing' | 'completed' | 'error' | 'cancelled';
}

const initialProgress = (): AutoCropProgress => ({
  phase: 'idle',
  current: 0,
  total: 0,
  processed: 0,
  failed: 0,
  noDetection: 0,
  fallbackUsed: 0,
});

const electronImageSource: AutoCropImageSource = {
  readImageBuffer: (path) => window.electronAPI.offline.readImageBuffer(path),
  savePngBuffer: (dir, name, buf, reduce) =>
    window.electronAPI.offline.savePngBuffer(dir, name, buf, reduce),
};

export function useAutoCrop() {
  const selectedImagePaths = ref<string[]>([]);
  const redBoxMode = ref(false);
  const showEdges = ref(false);
  const enablePngColorReduction = ref(true);
  const isProcessing = ref(false);
  const isCancelled = ref(false);
  const progress = ref<AutoCropProgress>(initialProgress());
  const outputDir = ref<string | null>(null);
  const detectorMode = ref<DetectorMode>('canny_then_yolo');

  const client = createAutoCropWorkerClient();
  onUnmounted(() => client.destroy());

  const selectImages = async (): Promise<void> => {
    const paths = await window.electronAPI.dialog?.openImageFiles?.();
    if (!paths || paths.length === 0) return;
    selectedImagePaths.value = paths;
    progress.value = initialProgress();
  };

  const startProcessing = async (): Promise<void> => {
    if (selectedImagePaths.value.length === 0) return;
    const images = [...selectedImagePaths.value];

    const config = configStore;
    const configuredOutputDir = config.outputDirectory || '';
    if (!configuredOutputDir) {
      console.error('No output directory configured');
      progress.value.phase = 'error';
      return;
    }
    const outDir = configuredOutputDir + '/cropped';
    outputDir.value = outDir;
    const slideCfg = config.slideExtraction;
    const mode: DetectorMode = slideCfg?.autoCropDetectorMode ?? 'canny_then_yolo';
    detectorMode.value = mode;

    isProcessing.value = true;
    isCancelled.value = false;
    progress.value = { ...initialProgress(), phase: 'processing', total: images.length };

    const result = await processBatch(
      client,
      electronImageSource,
      images,
      {
        outputDir: outDir,
        detectConfig: { mode, canny: slideCfg?.autoCrop, yolo: slideCfg?.autoCropYolo },
        redBoxMode: redBoxMode.value,
        showEdges: showEdges.value,
        enablePngColorReduction: enablePngColorReduction.value,
      },
      {
        onProgress: (p) => { progress.value = { ...progress.value, ...p }; },
        shouldCancel: () => isCancelled.value,
      },
    );

    progress.value = {
      ...progress.value,
      ...result,
      phase: isCancelled.value ? 'cancelled' : 'completed',
    };
    isProcessing.value = false;
  };

  const cancelProcessing = () => {
    isCancelled.value = true;
  };

  const openOutputFolder = async () => {
    if (outputDir.value) {
      await window.electronAPI.shell.openPath(outputDir.value);
    }
  };

  const reset = () => {
    selectedImagePaths.value = [];
    outputDir.value = null;
    progress.value = initialProgress();
  };

  const refreshDetectorMode = async (): Promise<DetectorMode> => {
    const config = configStore;
    const mode: DetectorMode = config.slideExtraction?.autoCropDetectorMode ?? 'canny_then_yolo';
    detectorMode.value = mode;
    return mode;
  };

  return {
    selectedImagePaths,
    redBoxMode,
    showEdges,
    enablePngColorReduction,
    isProcessing,
    progress,
    outputDir,
    detectorMode,
    selectImages,
    startProcessing,
    cancelProcessing,
    openOutputFolder,
    reset,
    refreshDetectorMode,
  };
}

export type UseAutoCrop = ReturnType<typeof useAutoCrop>;
