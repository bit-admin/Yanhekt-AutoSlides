import type { CustomProviderId } from '@common/types'

export type { CustomProviderId }

export const MODELSCOPE_API_BASE_URL = 'https://api-inference.modelscope.cn/v1'

export function detectCustomProvider(url: string): CustomProviderId {
  if (url.includes('api-inference.modelscope.cn')) return 'modelscope'
  return 'other'
}
