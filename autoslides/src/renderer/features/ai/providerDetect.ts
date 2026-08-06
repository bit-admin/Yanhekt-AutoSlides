export type CustomProviderId = 'modelscope' | 'opencode_zen' | 'nvidia' | 'agnes' | 'other'

export const MODELSCOPE_API_BASE_URL = 'https://api-inference.modelscope.cn/v1'
export const OPENCODE_ZEN_API_BASE_URL = 'https://opencode.ai/zen/v1'

export function detectCustomProvider(url: string): CustomProviderId {
  if (!url) return 'other'
  if (url.includes('api-inference.modelscope.cn')) return 'modelscope'
  if (url.includes('opencode.ai/zen')) return 'opencode_zen'
  if (url.includes('integrate.api.nvidia.com')) return 'nvidia'
  if (url.includes('apihub.agnes-ai.com')) return 'agnes'
  return 'other'
}
