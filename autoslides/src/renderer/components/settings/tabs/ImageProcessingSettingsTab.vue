<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.imageOutput') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.enablePngColorReduction') }}</label>
      <div class="setting-description">{{ $t('advanced.pngColorReductionDescription') }}</div>
      <div class="image-output-options">
        <label class="image-output-toggle-item">
          <input
            type="checkbox"
            v-model="tempEnablePngColorReduction"
          />
          <span class="image-output-toggle-text">{{ $t('advanced.enablePngColorReduction') }}</span>
        </label>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.imageProcessing') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.ssimThreshold') }}</label>
      <div class="setting-description">{{ $t('advanced.ssimDescription') }}</div>
      <div class="ssim-input-group">
        <input
          v-model.number="tempSsimThreshold"
          type="number"
          min="0.9"
          max="1.0"
          step="0.0001"
          class="ssim-input"
          @input="onSsimInputChange"
        />
        <select
          v-model="ssimPreset"
          @change="onSsimPresetChange"
          class="ssim-preset-select"
        >
          <option value="adaptive">{{ $t('advanced.ssimPresets.adaptive') }}</option>
          <option value="strict">{{ $t('advanced.ssimPresets.strict') }}</option>
          <option value="normal">{{ $t('advanced.ssimPresets.normal') }}</option>
          <option value="loose">{{ $t('advanced.ssimPresets.loose') }}</option>
          <option value="custom">{{ $t('advanced.ssimPresets.custom') }}</option>
        </select>
      </div>
      <div class="setting-description">{{ $t('advanced.ssimWarning') }}</div>

      <div class="classroom-rules-info">
        <div class="rules-title">{{ $t('advanced.classroomRules.title') }}</div>
        <div class="rules-description">{{ $t('advanced.classroomRules.description') }}</div>
        <ul class="rules-list">
          <li class="rule-item">
            <span class="rule-condition">{{ $t('advanced.classroomRules.rule1.condition') }}</span>
            <span class="rule-arrow">→</span>
            <span class="rule-action">{{ $t('advanced.classroomRules.rule1.action') }}</span>
          </li>
          <li class="rule-item">
            <span class="rule-condition">{{ $t('advanced.classroomRules.rule2.condition') }}</span>
            <span class="rule-arrow">→</span>
            <span class="rule-action">{{ $t('advanced.classroomRules.rule2.action') }}</span>
          </li>
          <li class="rule-item">
            <span class="rule-condition">{{ $t('advanced.classroomRules.rule3.condition') }}</span>
            <span class="rule-arrow">→</span>
            <span class="rule-action">{{ $t('advanced.classroomRules.rule3.action') }}</span>
          </li>
        </ul>
        <div class="rules-reason">{{ $t('advanced.classroomRules.reason') }}</div>
      </div>
    </div>

    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.enableDownsampling') }}</label>
      <div class="setting-description">{{ $t('advanced.downsamplingDescription') }}</div>
      <div class="downsampling-controls">
        <div class="downsampling-control">
          <label class="checkbox-label">
            <input
              v-model="tempEnableDownsampling"
              type="checkbox"
            />
            {{ $t('advanced.enableDownsampling') }}
          </label>
          <div v-if="tempEnableDownsampling" class="downsampling-presets">
            <button
              v-for="preset in downsamplingPresets"
              :key="preset.key"
              @click="selectDownsamplingPreset(preset)"
              :class="['preset-btn', { active: tempSelectedDownsamplingPreset === preset.key }]"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.postProcessing') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.postProcessingPhases') }}</label>
      <div class="post-processing-phases-list">
        <label class="phase-toggle-item">
          <input
            type="checkbox"
            v-model="tempEnableDuplicateRemoval"
          />
          <span class="phase-toggle-text">{{ $t('advanced.enableDuplicateRemoval') }}</span>
        </label>
        <label class="phase-toggle-item">
          <input
            type="checkbox"
            v-model="tempEnableExclusionList"
          />
          <span class="phase-toggle-text">{{ $t('advanced.enableExclusionList') }}</span>
        </label>
        <label class="phase-toggle-item">
          <input
            type="checkbox"
            v-model="tempEnableAIFiltering"
          />
          <span class="phase-toggle-text">{{ $t('advanced.enableAIFiltering') }}</span>
        </label>
      </div>
      <div v-if="tempEnableAIFiltering" class="setting-description ai-reminder">
        {{ $t('advanced.aiFilteringReminder') }}
      </div>
    </div>

    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.pHashThreshold') }}</label>
      <div class="setting-description">{{ $t('advanced.pHashDescription') }}</div>
      <div class="phash-threshold-input-wrapper">
        <input
          v-model.number="tempPHashThreshold"
          type="number"
          min="0"
          max="256"
          step="1"
          class="phash-threshold-input"
        />
        <span class="threshold-unit">{{ $t('advanced.hammingDistance') }}</span>
      </div>
    </div>

    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.pHashExclusionList') }}</label>
      <div class="setting-description">{{ $t('advanced.pHashExclusionDescription') }}</div>

      <div class="exclusion-list-container">
        <div v-if="pHashExclusionList.length === 0" class="exclusion-list-empty">
          {{ $t('advanced.noExclusionItems') }}
        </div>
        <div v-else class="exclusion-list">
          <div
            v-for="item in pHashExclusionList"
            :key="item.id"
            :class="['exclusion-item', {
              'preset-item': item.isPreset,
              'disabled-item': item.isPreset && !item.isEnabled
            }]"
          >
            <div class="exclusion-item-info">
              <div class="exclusion-item-name">
                <span v-if="item.isPreset" class="preset-badge">{{ $t('advanced.presetLabel') }}</span>
                {{ item.name }}
              </div>
              <div class="exclusion-item-hash" :title="item.pHash">{{ item.pHash }}</div>
            </div>
            <div class="exclusion-item-actions">
              <button
                v-if="!item.isPreset"
                @click="editExclusionItemName(item)"
                class="exclusion-edit-btn"
                :title="$t('advanced.editName')"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                @click="removeExclusionItem(item.id)"
                :class="item.isPreset ? 'exclusion-toggle-btn' : 'exclusion-remove-btn'"
                :title="item.isPreset ? (item.isEnabled ? $t('advanced.disableItem') : $t('advanced.enableItem')) : $t('advanced.removeItem')"
              >
                <svg v-if="item.isPreset" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <template v-if="item.isEnabled">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M9 12l2 2 4-4"/>
                  </template>
                  <template v-else>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </template>
                </svg>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="exclusion-actions">
        <button
          @click="addExclusionItem"
          :disabled="isAddingExclusion"
          class="exclusion-add-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {{ isAddingExclusion ? $t('advanced.processing') : $t('advanced.addExclusionItem') }}
        </button>
        <button
          v-if="pHashExclusionList.length > 0"
          @click="clearExclusionList"
          class="exclusion-clear-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
          {{ $t('advanced.clearAll') }}
        </button>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.autoCrop.title') }}</h4>
    <div class="setting-description">{{ $t('advanced.autoCrop.description') }}</div>

    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.autoCrop.detectorMode') }}</label>
      <div class="setting-description">{{ $t('advanced.autoCrop.detectorModeDescription') }}</div>
      <select v-model="tempAutoCropDetectorMode" class="select-field">
        <option value="canny_then_yolo">{{ $t('advanced.autoCrop.cannyThenYolo') }}</option>
        <option value="canny_only">{{ $t('advanced.autoCrop.cannyOnly') }}</option>
        <option value="yolo_only">{{ $t('advanced.autoCrop.yoloOnly') }}</option>
      </select>
    </div>

    <div v-if="tempAutoCropDetectorMode !== 'yolo_only'" class="advanced-setting-subsection">
      <h5>{{ $t('advanced.autoCrop.canny.title') }}</h5>

      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.autoCrop.aspectTolerance') }}</label>
        <div class="setting-description">{{ $t('advanced.autoCrop.aspectToleranceDescription') }}</div>
        <div class="slide-interval-input-wrapper">
          <input v-model.number="tempAutoCropAspectTolerance" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
        </div>
      </div>

      <div class="auto-crop-grid">
        <div class="setting-item">
          <label class="setting-label">{{ $t('advanced.autoCrop.blackThreshold') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.blackThresholdDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropBlackThreshold" type="number" min="0" max="255" step="1" class="slide-interval-input" />
            <span class="interval-unit">{{ $t('advanced.autoCrop.grayLevelUnit') }}</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('advanced.autoCrop.maxBorderFrac') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.maxBorderFracDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropMaxBorderFrac" type="number" min="0" max="0.5" step="0.01" class="slide-interval-input" />
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('advanced.autoCrop.cannyLowThreshold') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.cannyLowThresholdDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropCannyLowThreshold" type="number" min="0" max="255" step="1" class="slide-interval-input" />
            <span class="interval-unit">{{ $t('advanced.autoCrop.grayLevelUnit') }}</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('advanced.autoCrop.cannyHighThreshold') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.cannyHighThresholdDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropCannyHighThreshold" type="number" min="0" max="255" step="1" class="slide-interval-input" />
            <span class="interval-unit">{{ $t('advanced.autoCrop.grayLevelUnit') }}</span>
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('advanced.autoCrop.areaRatioMin') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.areaRatioMinDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropAreaRatioMin" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('advanced.autoCrop.areaRatioMax') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.areaRatioMaxDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropAreaRatioMax" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('advanced.autoCrop.marginFrac') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.marginFracDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropMarginFrac" type="number" min="0" max="0.5" step="0.005" class="slide-interval-input" />
          </div>
        </div>

        <div class="setting-item">
          <label class="setting-label">{{ $t('advanced.autoCrop.fillRatioMin') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.fillRatioMinDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropFillRatioMin" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="tempAutoCropDetectorMode !== 'canny_only'" class="advanced-setting-subsection">
      <h5>{{ $t('advanced.autoCrop.yolo.title') }}</h5>

      <div class="auto-crop-grid">
        <div class="setting-item full-width">
          <label class="setting-label">{{ $t('advanced.autoCrop.yolo.confidenceThreshold') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.yolo.confidenceThresholdDescription') }}</div>
          <div class="slide-interval-group">
            <div class="slide-interval-input-wrapper">
              <input
                v-model.number="tempAutoCropYoloConfidenceThreshold"
                type="number"
                min="0.05"
                max="0.95"
                step="0.05"
                class="slide-interval-input"
              />
            </div>
          </div>
        </div>

        <div class="setting-item full-width">
          <div class="two-col-row">
            <div class="two-col-item">
              <label class="setting-label">{{ $t('advanced.autoCrop.yolo.iouThreshold') }}</label>
              <div class="setting-description">{{ $t('advanced.autoCrop.yolo.iouThresholdDescription') }}</div>
              <div class="slide-interval-group">
                <div class="slide-interval-input-wrapper">
                  <input
                    v-model.number="tempAutoCropYoloIouThreshold"
                    type="number"
                    min="0.1"
                    max="0.9"
                    step="0.05"
                    class="slide-interval-input"
                  />
                </div>
              </div>
            </div>

            <div class="two-col-item">
              <label class="setting-label">{{ $t('advanced.autoCrop.yolo.inputSize') }}</label>
              <div class="setting-description">{{ $t('advanced.autoCrop.yolo.inputSizeDescription') }}</div>
              <div class="slide-interval-group">
                <div class="slide-interval-input-wrapper">
                  <select v-model.number="tempAutoCropYoloInputSize" class="slide-interval-input slide-interval-select">
                    <option v-for="s in autoCropYoloInputSizes" :key="s" :value="s">{{ s }}</option>
                  </select>
                  <span class="interval-unit">px</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="setting-item">
        <label class="setting-label">{{ $t('advanced.autoCrop.yolo.model.title') }}</label>
        <div class="setting-description">{{ $t('advanced.autoCrop.yolo.model.hint') }}</div>
        <div class="model-row" v-if="autoCropModelInfo">
          <div class="model-info" v-if="autoCropModelInfo.active === 'custom' && autoCropModelInfo.customExists">
            <strong>{{ $t('advanced.autoCrop.yolo.model.customLabel') }}:</strong>
            {{ autoCropModelInfo.customName || '—' }}
            <span v-if="autoCropModelInfo.customSizeBytes" class="model-size">
              ({{ formatCacheSize(autoCropModelInfo.customSizeBytes) }})
            </span>
          </div>
          <div class="model-info" v-else>
            <strong>{{ $t('advanced.autoCrop.yolo.model.builtinLabel') }}:</strong>
            {{ autoCropModelInfo.builtinVersion }}
            <span v-if="autoCropModelInfo.builtinSizeBytes" class="model-size">
              ({{ formatCacheSize(autoCropModelInfo.builtinSizeBytes) }})
            </span>
          </div>
          <div class="model-actions">
            <button type="button" class="secondary-btn" @click="selectAutoCropCustomModel">
              {{ $t('advanced.autoCrop.yolo.model.selectButton') }}
            </button>
            <button
              type="button"
              class="secondary-btn"
              :disabled="!autoCropModelInfo.customExists"
              @click="deleteAutoCropCustomModel"
            >
              {{ $t('advanced.autoCrop.yolo.model.deleteButton') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSettingsContext } from '@features/settings/settingsContext'

const { settings, advanced, cache, phash } = useSettingsContext()

const { tempEnableAIFiltering } = settings

const {
  tempEnablePngColorReduction,
  tempSsimThreshold,
  ssimPreset,
  onSsimInputChange,
  onSsimPresetChange,
  tempEnableDownsampling,
  downsamplingPresets,
  selectDownsamplingPreset,
  tempSelectedDownsamplingPreset,
  tempEnableDuplicateRemoval,
  tempEnableExclusionList,
  tempPHashThreshold,
  tempAutoCropDetectorMode,
  tempAutoCropAspectTolerance,
  tempAutoCropBlackThreshold,
  tempAutoCropMaxBorderFrac,
  tempAutoCropCannyLowThreshold,
  tempAutoCropCannyHighThreshold,
  tempAutoCropAreaRatioMin,
  tempAutoCropAreaRatioMax,
  tempAutoCropMarginFrac,
  tempAutoCropFillRatioMin,
  tempAutoCropYoloConfidenceThreshold,
  tempAutoCropYoloIouThreshold,
  tempAutoCropYoloInputSize,
  autoCropYoloInputSizes,
  autoCropModelInfo,
  selectAutoCropCustomModel,
  deleteAutoCropCustomModel,
} = advanced

const { formatCacheSize } = cache

const {
  pHashExclusionList,
  isAddingExclusion,
  addExclusionItem,
  removeExclusionItem,
  editExclusionItemName,
  clearExclusionList,
} = phash
</script>

<style scoped>
.post-processing-phases-list,
.image-output-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.phase-toggle-item,
.image-output-toggle-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background-color: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.phase-toggle-item:hover,
.image-output-toggle-item:hover {
  background-color: var(--bg-hover);
  border-color: var(--border-strong);
}

.phase-toggle-item input[type="checkbox"],
.image-output-toggle-item input[type="checkbox"] {
  margin: 0;
  cursor: pointer;
  width: 14px;
  height: 14px;
  accent-color: var(--accent);
}

.phase-toggle-text,
.image-output-toggle-text {
  font-size: 12px;
  color: var(--text-primary);
}

.ssim-input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.ssim-preset-select {
  flex: 0 0 auto;
  min-width: 140px;
  padding: 6px 8px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 12px;
  background-color: var(--bg-input);
  color: var(--text-primary);
  cursor: pointer;
  transition: border-color 0.2s;
}

.ssim-preset-select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.ssim-input {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid var(--border-input);
  border-radius: 4px;
  font-size: 12px;
  background-color: var(--bg-input);
  color: var(--text-primary);
}

.ssim-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.phash-threshold-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background-color: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: 4px;
  transition: border-color 0.2s;
}

.phash-threshold-input-wrapper:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus-ring);
}

.phash-threshold-input {
  flex: 1;
  padding: 6px 8px;
  border: none;
  background-color: transparent;
  font-size: 12px;
  outline: none;
}

.threshold-unit {
  padding: 6px 8px;
  font-size: 11px;
  color: var(--text-secondary);
  background-color: var(--bg-elevated);
  border-left: 1px solid var(--border-color);
  white-space: nowrap;
}

.classroom-rules-info {
  margin-top: 12px;
  padding: 12px;
  background-color: var(--bg-elevated);
  border: 1px solid var(--bg-hover);
  border-radius: 6px;
  font-size: 11px;
}

.rules-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
  font-size: 12px;
}

.rules-description {
  color: var(--text-secondary);
  margin-bottom: 8px;
  line-height: 1.4;
}

.rules-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rule-item {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
  padding: 4px 0;
}

.rule-condition {
  color: var(--text-primary);
  font-weight: 500;
  background-color: var(--badge-active-bg);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.rule-arrow {
  margin: 0 8px;
  color: var(--text-secondary);
  font-weight: bold;
}

.rule-action {
  color: var(--success);
  font-weight: 500;
  background-color: var(--success-bg);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.rules-reason {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--bg-hover);
  color: var(--text-secondary);
  font-style: italic;
  line-height: 1.4;
}

.auto-crop-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
  row-gap: 0;
  margin-bottom: 20px;
}

.auto-crop-grid .setting-item {
  margin-bottom: 16px;
}

.auto-crop-grid .setting-item:last-child {
  margin-top: 0;
}

.auto-crop-grid .setting-item.full-width {
  grid-column: 1 / -1;
}

.auto-crop-grid .setting-item .slide-interval-input-wrapper {
  width: 100%;
  box-sizing: border-box;
}

.advanced-setting-subsection {
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}

.advanced-setting-subsection h5 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #222);
}

/* Borderless select inside .slide-interval-input-wrapper — reuses the shared
   .slide-interval-input look; this modifier only adds the pointer cursor. */
.slide-interval-select {
  cursor: pointer;
}

.two-col-row {
  display: flex;
  gap: 12px;
}

.two-col-item {
  flex: 1;
}

.two-col-item .setting-label {
  margin-bottom: 6px;
}

.exclusion-list-container {
  margin-bottom: 12px;
}

.exclusion-list-empty {
  padding: 12px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 11px;
  font-style: italic;
  background-color: var(--bg-elevated);
  border: 1px solid var(--bg-hover);
  border-radius: 4px;
}

.exclusion-list {
  border: 1px solid var(--bg-hover);
  border-radius: 4px;
  background-color: var(--bg-elevated);
  max-height: 200px;
  overflow-y: auto;
}

.exclusion-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--bg-hover);
  background-color: var(--bg-surface);
  transition: background-color 0.2s;
}

.exclusion-item:last-child {
  border-bottom: none;
}

.exclusion-item:hover {
  background-color: var(--bg-elevated);
}

.exclusion-item.preset-item {
  border-left: 3px solid var(--accent);
}

.exclusion-item.disabled-item {
  opacity: 0.6;
  background-color: var(--bg-elevated);
}

.exclusion-item.disabled-item .exclusion-item-name,
.exclusion-item.disabled-item .exclusion-item-hash {
  color: var(--text-muted);
}

.exclusion-item-info {
  flex: 1;
  min-width: 0;
}

.exclusion-item-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
}

.preset-badge {
  font-size: 9px;
  font-weight: 600;
  color: var(--accent);
  background-color: var(--badge-active-bg);
  padding: 2px 6px;
  border-radius: 8px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.exclusion-item-hash {
  font-size: 10px;
  color: var(--text-secondary);
  font-family: 'Courier New', monospace;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: break-all;
}

.exclusion-item-actions {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.exclusion-edit-btn, .exclusion-remove-btn, .exclusion-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: 1px solid var(--border-input);
  border-radius: 3px;
  background-color: var(--bg-elevated);
  cursor: pointer;
  transition: all 0.2s;
}

.exclusion-edit-btn {
  color: var(--accent);
}

.exclusion-edit-btn:hover {
  background-color: var(--accent);
  color: var(--text-on-accent);
  border-color: var(--accent);
}

.exclusion-remove-btn {
  color: var(--danger-bright);
}

.exclusion-remove-btn:hover {
  background-color: var(--danger);
  color: var(--text-on-accent);
  border-color: var(--danger);
}

.exclusion-toggle-btn {
  color: var(--success);
}

.exclusion-toggle-btn:hover {
  background-color: var(--success);
  color: var(--text-on-accent);
  border-color: var(--success);
}

.exclusion-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.exclusion-add-btn, .exclusion-clear-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
  flex: 1;
  min-width: 0;
  justify-content: center;
}

.exclusion-add-btn {
  background-color: var(--success);
  border-color: var(--success);
  color: var(--text-on-accent);
}

.exclusion-add-btn:hover:not(:disabled) {
  background-color: var(--success);
  border-color: var(--success);
}

.exclusion-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.exclusion-clear-btn {
  background-color: var(--warning-btn);
  border-color: var(--warning-btn);
  color: var(--text-on-accent);
}

.exclusion-clear-btn:hover {
  background-color: var(--warning-btn-hover);
  border-color: var(--warning-btn-hover);
}


</style>
