export type CustomProviderId = 'modelscope' | 'lm_studio' | 'nvidia' | 'agnes' | 'other'

export const MODELSCOPE_API_BASE_URL = 'https://api-inference.modelscope.cn/v1'

export function detectCustomProvider(url: string): CustomProviderId {
  if (!url) return 'other'
  if (url.includes('api-inference.modelscope.cn')) return 'modelscope'
  if (/localhost:1234|127\.0\.0\.1:1234/.test(url)) return 'lm_studio'
  if (url.includes('integrate.api.nvidia.com')) return 'nvidia'
  if (url.includes('apihub.agnes-ai.com')) return 'agnes'
  return 'other'
}
