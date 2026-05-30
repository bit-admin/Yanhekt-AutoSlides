<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.imageOutput') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.enablePngColorReduction') }}</label>
      <div class="setting-description">{{ $t('advanced.pngColorReductionDescription') }}</div>
      <div class="flex flex-col gap-1.5">
        <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border-strong">
          <input
            type="checkbox"
            v-model="tempEnablePngColorReduction"
            class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent"
          />
          <span class="text-xs text-text">{{ $t('advanced.enablePngColorReduction') }}</span>
        </label>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.imageProcessing') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.ssimThreshold') }}</label>
      <div class="setting-description">{{ $t('advanced.ssimDescription') }}</div>
      <div class="flex gap-2 items-center mb-1">
        <input
          v-model.number="tempSsimThreshold"
          type="number"
          min="0.9"
          max="1.0"
          step="0.0001"
          class="flex-1 py-1.5 px-2 border border-border-input rounded text-xs bg-surface focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
          @input="onSsimInputChange"
        />
        <select
          v-model="ssimPreset"
          @change="onSsimPresetChange"
          class="shrink-0 min-w-[140px] py-1.5 px-2 border border-border-input rounded text-xs bg-surface cursor-pointer transition-[border-color] focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/10"
        >
          <option value="adaptive">{{ $t('advanced.ssimPresets.adaptive') }}</option>
          <option value="strict">{{ $t('advanced.ssimPresets.strict') }}</option>
          <option value="normal">{{ $t('advanced.ssimPresets.normal') }}</option>
          <option value="loose">{{ $t('advanced.ssimPresets.loose') }}</option>
          <option value="custom">{{ $t('advanced.ssimPresets.custom') }}</option>
        </select>
      </div>
      <div class="setting-description">{{ $t('advanced.ssimWarning') }}</div>

      <div class="mt-3 p-3 bg-elevated border border-border rounded-md text-[11px]">
        <div class="font-semibold text-text mb-1.5 text-xs">{{ $t('advanced.classroomRules.title') }}</div>
        <div class="text-text-secondary mb-2 leading-snug">{{ $t('advanced.classroomRules.description') }}</div>
        <ul class="m-0 p-0 list-none">
          <li class="flex items-center mb-1 py-1">
            <span class="text-text font-medium bg-accent/10 px-1.5 py-0.5 rounded-sm text-[10px]">{{ $t('advanced.classroomRules.rule1.condition') }}</span>
            <span class="mx-2 text-text-secondary font-bold">&rarr;</span>
            <span class="text-success font-medium bg-success/10 px-1.5 py-0.5 rounded-sm text-[10px]">{{ $t('advanced.classroomRules.rule1.action') }}</span>
          </li>
          <li class="flex items-center mb-1 py-1">
            <span class="text-text font-medium bg-accent/10 px-1.5 py-0.5 rounded-sm text-[10px]">{{ $t('advanced.classroomRules.rule2.condition') }}</span>
            <span class="mx-2 text-text-secondary font-bold">&rarr;</span>
            <span class="text-success font-medium bg-success/10 px-1.5 py-0.5 rounded-sm text-[10px]">{{ $t('advanced.classroomRules.rule2.action') }}</span>
          </li>
          <li class="flex items-center mb-1 py-1">
            <span class="text-text font-medium bg-accent/10 px-1.5 py-0.5 rounded-sm text-[10px]">{{ $t('advanced.classroomRules.rule3.condition') }}</span>
            <span class="mx-2 text-text-secondary font-bold">&rarr;</span>
            <span class="text-success font-medium bg-success/10 px-1.5 py-0.5 rounded-sm text-[10px]">{{ $t('advanced.classroomRules.rule3.action') }}</span>
          </li>
        </ul>
        <div class="mt-2 pt-2 border-t border-border text-text-secondary italic leading-snug">{{ $t('advanced.classroomRules.reason') }}</div>
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
      <div class="flex flex-col gap-1.5">
        <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border-strong">
          <input
            type="checkbox"
            v-model="tempEnableDuplicateRemoval"
            class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent"
          />
          <span class="text-xs text-text">{{ $t('advanced.enableDuplicateRemoval') }}</span>
        </label>
        <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border-strong">
          <input
            type="checkbox"
            v-model="tempEnableExclusionList"
            class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent"
          />
          <span class="text-xs text-text">{{ $t('advanced.enableExclusionList') }}</span>
        </label>
        <label class="flex items-center gap-2 py-2 px-2.5 bg-elevated border border-border-input rounded cursor-pointer transition-all hover:bg-hover hover:border-border-strong">
          <input
            type="checkbox"
            v-model="tempEnableAIFiltering"
            class="m-0 cursor-pointer w-3.5 h-3.5 accent-accent"
          />
          <span class="text-xs text-text">{{ $t('advanced.enableAIFiltering') }}</span>
        </label>
      </div>
      <div v-if="tempEnableAIFiltering" class="setting-description mt-2 text-warning">
        {{ $t('advanced.aiFilteringReminder') }}
      </div>
    </div>

    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.pHashThreshold') }}</label>
      <div class="setting-description">{{ $t('advanced.pHashDescription') }}</div>
      <div class="relative flex items-center w-full bg-surface border border-border-input rounded transition-[border-color] focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/10">
        <input
          v-model.number="tempPHashThreshold"
          type="number"
          min="0"
          max="256"
          step="1"
          class="flex-1 py-1.5 px-2 border-none bg-transparent text-xs outline-none text-text"
        />
        <span class="py-1.5 px-2 text-[11px] text-text-secondary bg-elevated border-l border-border whitespace-nowrap">{{ $t('advanced.hammingDistance') }}</span>
      </div>
    </div>

    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.pHashExclusionList') }}</label>
      <div class="setting-description">{{ $t('advanced.pHashExclusionDescription') }}</div>

      <div class="mb-3">
        <div v-if="pHashExclusionList.length === 0" class="p-3 text-center text-text-secondary text-[11px] italic bg-elevated border border-border rounded">
          {{ $t('advanced.noExclusionItems') }}
        </div>
        <div v-else class="border border-border rounded bg-elevated max-h-[200px] overflow-y-auto">
          <div
            v-for="item in pHashExclusionList"
            :key="item.id"
            :class="['group/exclusion flex items-center justify-between py-2 px-3 bg-surface transition-colors hover:bg-elevated border-b border-b-border last:border-b-0', {
              'border-l-[3px] border-l-accent': item.isPreset,
              'opacity-60 bg-elevated': item.isPreset && !item.isEnabled,
            }]"
          >
            <div class="flex-1 min-w-0">
              <div :class="['text-xs font-medium mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1.5', item.isPreset && !item.isEnabled ? 'text-text-muted' : 'text-text']">
                <span v-if="item.isPreset" class="text-[9px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded-lg uppercase tracking-[0.3px] shrink-0">{{ $t('advanced.presetLabel') }}</span>
                {{ item.name }}
              </div>
              <div :class="['text-[10px] font-mono mb-0.5 overflow-hidden text-ellipsis whitespace-nowrap break-all', item.isPreset && !item.isEnabled ? 'text-text-muted' : 'text-text-secondary']" :title="item.pHash">{{ item.pHash }}</div>
            </div>
            <div class="flex gap-1 ml-2">
              <button
                v-if="!item.isPreset"
                @click="editExclusionItemName(item)"
                class="flex items-center justify-center w-6 h-6 border border-border-input rounded-sm bg-elevated cursor-pointer transition-all text-accent hover:bg-accent hover:text-white hover:border-accent"
                :title="$t('advanced.editName')"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                @click="removeExclusionItem(item.id)"
                :class="item.isPreset ? 'flex items-center justify-center w-6 h-6 border border-border-input rounded-sm bg-elevated cursor-pointer transition-all text-success hover:bg-success hover:text-white hover:border-success' : 'flex items-center justify-center w-6 h-6 border border-border-input rounded-sm bg-elevated cursor-pointer transition-all text-danger hover:bg-danger hover:text-white hover:border-danger'"
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
                  <path d="m19,6v14a2,2 0 0,1 -2,2H7a2 2 0 0,1 -2,-2V6m3,0V4a2 2 0 0,1 2,-2h4a2 2 0 0,1 2,2v2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-2 flex-wrap">
        <button
          @click="addExclusionItem"
          :disabled="isAddingExclusion"
          class="flex items-center gap-1.5 py-1.5 px-3 border rounded text-[11px] cursor-pointer transition-all flex-1 min-w-0 justify-center bg-success border-success text-white hover:not(:disabled):bg-success/85 hover:not(:disabled):border-success/85 disabled:opacity-50 disabled:cursor-not-allowed"
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
          class="flex items-center gap-1.5 py-1.5 px-3 border rounded text-[11px] cursor-pointer transition-all flex-1 min-w-0 justify-center bg-warning border-warning text-text hover:bg-warning/85 hover:border-warning/85"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2 2 0 0,1 -2,-2V6m3,0V4a2 2 0 0,1 2,-2h4a2 2 0 0,1 2,2v2"/>
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
      <select v-model="tempAutoCropDetectorMode" class="concurrent-select">
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

      <div class="grid grid-cols-2 gap-x-4 gap-y-0 mb-5">
        <div class="setting-item mb-4">
          <label class="setting-label">{{ $t('advanced.autoCrop.blackThreshold') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.blackThresholdDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropBlackThreshold" type="number" min="0" max="255" step="1" class="slide-interval-input" />
            <span class="interval-unit">{{ $t('advanced.autoCrop.grayLevelUnit') }}</span>
          </div>
        </div>

        <div class="setting-item mb-4">
          <label class="setting-label">{{ $t('advanced.autoCrop.maxBorderFrac') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.maxBorderFracDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropMaxBorderFrac" type="number" min="0" max="0.5" step="0.01" class="slide-interval-input" />
          </div>
        </div>

        <div class="setting-item mb-4">
          <label class="setting-label">{{ $t('advanced.autoCrop.cannyLowThreshold') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.cannyLowThresholdDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropCannyLowThreshold" type="number" min="0" max="255" step="1" class="slide-interval-input" />
            <span class="interval-unit">{{ $t('advanced.autoCrop.grayLevelUnit') }}</span>
          </div>
        </div>

        <div class="setting-item mb-4">
          <label class="setting-label">{{ $t('advanced.autoCrop.cannyHighThreshold') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.cannyHighThresholdDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropCannyHighThreshold" type="number" min="0" max="255" step="1" class="slide-interval-input" />
            <span class="interval-unit">{{ $t('advanced.autoCrop.grayLevelUnit') }}</span>
          </div>
        </div>

        <div class="setting-item mb-4">
          <label class="setting-label">{{ $t('advanced.autoCrop.areaRatioMin') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.areaRatioMinDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropAreaRatioMin" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
          </div>
        </div>

        <div class="setting-item mb-4">
          <label class="setting-label">{{ $t('advanced.autoCrop.areaRatioMax') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.areaRatioMaxDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropAreaRatioMax" type="number" min="0" max="1" step="0.01" class="slide-interval-input" />
          </div>
        </div>

        <div class="setting-item mb-4">
          <label class="setting-label">{{ $t('advanced.autoCrop.marginFrac') }}</label>
          <div class="setting-description">{{ $t('advanced.autoCrop.marginFracDescription') }}</div>
          <div class="slide-interval-input-wrapper">
            <input v-model.number="tempAutoCropMarginFrac" type="number" min="0" max="0.5" step="0.005" class="slide-interval-input" />
          </div>
        </div>

        <div class="setting-item mb-4">
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

      <div class="grid grid-cols-2 gap-x-4 gap-y-0 mb-5">
        <div class="setting-item mb-4 col-span-2">
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

        <div class="setting-item mb-4 col-span-2">
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
                  <select v-model.number="tempAutoCropYoloInputSize" class="slide-interval-input">
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
