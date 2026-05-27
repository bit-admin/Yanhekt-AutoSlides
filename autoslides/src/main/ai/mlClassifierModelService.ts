import { ConfigService } from '@main/platform/configService';
import { OnnxModelService, OnnxModelInfo } from '@main/infra/onnxModelService';

export type MlClassifierModelInfo = OnnxModelInfo;

export class MlClassifierModelService extends OnnxModelService {
  constructor(config: ConfigService) {
    super({
      builtinModelName: 'slide-classifier-v1.onnx',
      builtinModelVersion: 'slide-classifier-v1',
      customModelFilename: 'custom-classifier.onnx',
      dialogTitle: 'Select Custom Classifier Model',
      notFoundLabel: 'ML classifier model',
      getActiveModel: () => config.getAIFilteringConfig().mlClassifierActiveModel,
      getCustomModelName: () => config.getAIFilteringConfig().mlClassifierCustomModelName,
      setActiveModel: (value) => config.setMlClassifierActiveModel(value),
      setCustomModelName: (value) => config.setMlClassifierCustomModelName(value)
    });
  }
}
