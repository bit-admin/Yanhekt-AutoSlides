import { describe, expect, it, vi } from 'vitest';
import type { AutoCropWorkerClient } from '@shared/autoCrop';
import { runBaselineCropPipeline, runResultsAutoCropPipeline } from './resultsCropPipeline';

const target = {
  id: 'trash-entry',
  originalPath: '/out/slides_test/Slide_001.png',
  filename: 'Slide_001.png',
  needsRestore: true,
};

function cropIO() {
  return {
    restoreFromTrash: vi.fn(async () => ({ restoredIds: [] })),
    readImageBuffer: vi.fn(async () => new Uint8Array()),
    applyCrop: vi.fn(),
  };
}

describe('cropping slides from the trash', () => {
  it('does not open or crop a replacement at the original path after a failed restore', async () => {
    const auto = cropIO();
    const baseline = cropIO();
    const client = {} as AutoCropWorkerClient;
    const rect = { x: 0, y: 0, width: 2, height: 2 };
    expect(await runResultsAutoCropPipeline([target], client, {}, auto))
      .toMatchObject({ restoreFailed: 1, failed: 1, cropped: 0 });
    expect(await runBaselineCropPipeline([target], rect, baseline))
      .toMatchObject({ restoreFailed: 1, failed: 1, cropped: 0 });
    for (const io of [auto, baseline]) {
      expect(io.restoreFromTrash).toHaveBeenCalledWith([target.id]);
      expect(io.readImageBuffer).not.toHaveBeenCalled();
      expect(io.applyCrop).not.toHaveBeenCalled();
    }
  });
});
