import { ConfigService } from './configService';
import { OnnxModelService, OnnxModelInfo } from './onnxModelService';

export type AutoCropModelInfo = OnnxModelInfo;

export class AutoCropModelService extends OnnxModelService {
  constructor(config: ConfigService) {
    super({
      builtinModelName: 'slide-detect-v1.onnx',
      builtinModelVersion: 'slide-detect-v1',
      customModelFilename: 'custom-model.onnx',
      dialogTitle: 'Select Custom YOLO Model',
      notFoundLabel: 'Auto-crop model',
      getActiveModel: () => config.getSlideExtractionConfig().autoCropActiveModel,
      getCustomModelName: () => config.getSlideExtractionConfig().autoCropCustomModelName,
      setActiveModel: (value) => config.setAutoCropActiveModel(value),
      setCustomModelName: (value) => config.setAutoCropCustomModelName(value)
    });
  }
}
