<template>
  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.imageOutput') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.enablePngColorReduction') }}</label>
      <div class="setting-description">{{ $t('advanced.pngColorReductionDescription') }}</div>
      <div class="flex flex-col gap-1.5">
        <label :class="toggleItemCls">
          <input
            type="checkbox"
            v-model="tempEnablePngColorReduction"
            class="m-0 h-3.5 w-3.5 cursor-pointer accent-accent"
          />
          <span class="text-xs text-fg">{{ $t('advanced.enablePngColorReduction') }}</span>
        </label>
      </div>
    </div>
  </div>

  <div class="advanced-setting-section">
    <h4>{{ $t('advanced.imageProcessing') }}</h4>
    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.ssimThreshold') }}</label>
      <div class="setting-description">{{ $t('advanced.ssimDescription') }}</div>
      <div class="mb-1 flex items-center gap-2">
        <input
          v-model.number="tempSsimThreshold"
          type="number"
          min="0.9"
          max="1.0"
          step="0.0001"
          class="input flex-1"
          @input="onSsimInputChange"
        />
        <select
          v-model="ssimPreset"
          @change="onSsimPresetChange"
          class="select !w-auto min-w-[140px] flex-none cursor-pointer"
        >
          <option value="adaptive">{{ $t('advanced.ssimPresets.adaptive') }}</option>
          <option value="strict">{{ $t('advanced.ssimPresets.strict') }}</option>
          <option value="normal">{{ $t('advanced.ssimPresets.normal') }}</option>
          <option value="loose">{{ $t('advanced.ssimPresets.loose') }}</option>
          <option value="custom">{{ $t('advanced.ssimPresets.custom') }}</option>
        </select>
      </div>
      <div class="setting-description">{{ $t('advanced.ssimWarning') }}</div>

      <div class="mt-3 rounded-md border border-line bg-elevated p-3 text-[11px]">
        <div class="mb-1.5 text-xs font-semibold text-[#495057] dark:text-[#e0e0e0]">{{ $t('advanced.classroomRules.title') }}</div>
        <div class="mb-2 leading-[1.4] text-[#6c757d] dark:text-[#b0b0b0]">{{ $t('advanced.classroomRules.description') }}</div>
        <ul class="m-0 list-none p-0">
          <li v-for="r in [1, 2, 3]" :key="r" class="mb-1 flex items-center py-1">
            <span class="rounded-[3px] bg-[#e3f2fd] px-1.5 py-0.5 text-[10px] font-medium text-[#495057] dark:bg-[#1a2332] dark:text-[#e0e0e0]">{{ $t(`advanced.classroomRules.rule${r}.condition`) }}</span>
            <span class="mx-2 font-bold text-[#6c757d] dark:text-[#b0b0b0]">→</span>
            <span class="rounded-[3px] bg-[#d4edda] px-1.5 py-0.5 text-[10px] font-medium text-[#28a745] dark:bg-[#1b2e1b] dark:text-[#4caf50]">{{ $t(`advanced.classroomRules.rule${r}.action`) }}</span>
          </li>
        </ul>
        <div class="mt-2 border-t border-[#dee2e6] pt-2 italic leading-[1.4] text-[#6c757d] dark:border-[#404040] dark:text-[#b0b0b0]">{{ $t('advanced.classroomRules.reason') }}</div>
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
        <label :class="toggleItemCls">
          <input type="checkbox" v-model="tempEnableDuplicateRemoval" class="m-0 h-3.5 w-3.5 cursor-pointer accent-accent" />
          <span class="text-xs text-fg">{{ $t('advanced.enableDuplicateRemoval') }}</span>
        </label>
        <label :class="toggleItemCls">
          <input type="checkbox" v-model="tempEnableExclusionList" class="m-0 h-3.5 w-3.5 cursor-pointer accent-accent" />
          <span class="text-xs text-fg">{{ $t('advanced.enableExclusionList') }}</span>
        </label>
        <label :class="toggleItemCls">
          <input type="checkbox" v-model="tempEnableAIFiltering" class="m-0 h-3.5 w-3.5 cursor-pointer accent-accent" />
          <span class="text-xs text-fg">{{ $t('advanced.enableAIFiltering') }}</span>
        </label>
      </div>
      <div v-if="tempEnableAIFiltering" class="setting-description">
        {{ $t('advanced.aiFilteringReminder') }}
      </div>
    </div>

    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.pHashThreshold') }}</label>
      <div class="setting-description">{{ $t('advanced.pHashDescription') }}</div>
      <div class="slide-interval-input-wrapper">
        <input
          v-model.number="tempPHashThreshold"
          type="number"
          min="0"
          max="256"
          step="1"
          class="slide-interval-input"
        />
        <span class="interval-unit">{{ $t('advanced.hammingDistance') }}</span>
      </div>
    </div>

    <div class="setting-item">
      <label class="setting-label">{{ $t('advanced.pHashExclusionList') }}</label>
      <div class="setting-description">{{ $t('advanced.pHashExclusionDescription') }}</div>

      <div class="mb-3">
        <div v-if="pHashExclusionList.length === 0" class="rounded border border-line bg-elevated p-3 text-center text-[11px] italic text-fg-secondary">
          {{ $t('advanced.noExclusionItems') }}
        </div>
        <div v-else class="max-h-[200px] overflow-y-auto rounded border border-line bg-elevated">
          <div
            v-for="item in pHashExclusionList"
            :key="item.id"
            class="flex items-center justify-between border-b border-line bg-modal px-3 py-2 transition-colors last:border-b-0 hover:bg-elevated"
            :class="{
              'border-l-[3px] border-l-accent': item.isPreset,
              'opacity-60': item.isPreset && !item.isEnabled
            }"
          >
            <div class="min-w-0 flex-1">
              <div class="mb-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-fg">
                <span v-if="item.isPreset" class="flex-shrink-0 rounded-lg bg-[#e3f2fd] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.3px] text-accent dark:bg-[#1a2332] dark:text-[#4a9eff]">{{ $t('advanced.presetLabel') }}</span>
                {{ item.name }}
              </div>
              <div class="mb-0.5 truncate break-all font-mono text-[10px] text-fg-secondary" :title="item.pHash">{{ item.pHash }}</div>
            </div>
            <div class="ml-2 flex gap-1">
              <button
                v-if="!item.isPreset"
                @click="editExclusionItemName(item)"
                :class="[exclBtnBase, exclBtnEdit]"
                :title="$t('advanced.editName')"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                @click="removeExclusionItem(item.id)"
                :class="[exclBtnBase, item.isPreset ? exclBtnToggle : exclBtnRemove]"
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

      <div class="flex flex-wrap gap-2">
        <button
          @click="addExclusionItem"
          :disabled="isAddingExclusion"
          :class="[exclActionBtn, exclAddBtn]"
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
          :class="[exclActionBtn, exclClearBtn]"
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

      <div class="mb-5 grid grid-cols-2 gap-x-4">
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

      <div class="mb-5 grid grid-cols-2 gap-x-4">
        <div class="setting-item col-span-2">
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

        <div class="setting-item col-span-2">
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
                  <select v-model.number="tempAutoCropYoloInputSize" class="flex-1 border-none bg-transparent px-2 py-1.5 text-xs text-fg outline-none">
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

// Repeated bespoke patterns (toggle rows, exclusion buttons). Theme-aware.
const toggleItemCls =
  'flex cursor-pointer items-center gap-2 rounded border border-[#ddd] bg-[#f8f9fa] px-2.5 py-2 transition-colors hover:border-[#ccc] hover:bg-[#f0f0f0] dark:border-[#404040] dark:bg-[#2d2d2d] dark:hover:border-[#505050] dark:hover:bg-[#3d3d3d]'
const exclBtnBase =
  'flex h-6 w-6 cursor-pointer items-center justify-center rounded-[3px] border border-[#ddd] bg-[#f8f9fa] transition-all dark:border-[#404040] dark:bg-[#2d2d2d]'
const exclBtnEdit = 'text-accent hover:border-accent hover:bg-accent hover:text-white'
const exclBtnRemove =
  'text-[#dc3545] hover:border-[#dc3545] hover:bg-[#dc3545] hover:text-white dark:text-[#ff6b6b] dark:hover:border-[#ff6b6b] dark:hover:bg-[#ff6b6b]'
const exclBtnToggle =
  'text-[#28a745] hover:border-[#28a745] hover:bg-[#28a745] hover:text-white dark:text-[#4caf50] dark:hover:border-[#4caf50] dark:hover:bg-[#4caf50]'
const exclActionBtn =
  'flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-[11px] transition-all'
const exclAddBtn =
  'border-[#28a745] bg-[#28a745] text-white enabled:hover:border-[#218838] enabled:hover:bg-[#218838] disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#4caf50] dark:bg-[#4caf50] dark:enabled:hover:border-[#45a049] dark:enabled:hover:bg-[#45a049]'
const exclClearBtn =
  'border-[#ffc107] bg-[#ffc107] text-[#212529] hover:border-[#e0a800] hover:bg-[#e0a800] dark:border-[#f39c12] dark:bg-[#f39c12] dark:text-[#1a1a1a] dark:hover:border-[#e67e22] dark:hover:bg-[#e67e22]'
</script>

