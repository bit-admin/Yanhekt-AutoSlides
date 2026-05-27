// Unified AI-error classification. Extracted from postProcessingService.ts (typed
// errorKind tree + regex fallback) and usePostProcessing.ts (kindToBannerType).
//
// The transport layer (llmApiService) emits a typed `errorKind` plus a string
// `error` message. The classifier here turns that pair into:
//   - `ErrorInfo`         — pipeline retry decisions (used by phase3AI)
//   - `BannerError`       — UI banner display (used by usePostProcessing)
//
// Two cardinal rules preserved from the original code:
//   1. Transport already retries `rate_limited` and `upstream_rate_limited` with
//      exponential backoff. The pipeline must NOT re-retry those — they are
//      classified retryable=false here.
//   2. Only `network` and `timeout` are pipeline-level retryable. 413 is handled
//      via the split-batch path, not retry.

import type { AIErrorKind } from './types'

export type ErrorType =
  | 'network'
  | 'timeout'
  | '403'
  | '413'
  | '429'
  | 'quota_exceeded'
  | 'service_unavailable'
  | 'parse_failed'
  | 'http'
  | 'unknown'

export interface ErrorInfo {
  type: ErrorType
  message: string
  retryable: boolean
  kind?: AIErrorKind
}

export interface BannerError {
  type: 'none' | '403' | '413' | '429' | 'http' | 'unknown'
  httpCode?: number
  message?: string
}

const HTTP_CODE_REGEXES: RegExp[] = [
  /HTTP\s*(\d{3})/i,
  /status[:\s]*(\d{3})/i,
  /(\d{3})/
]

function isPayloadTooLarge(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes('413') || lower.includes('payload too large') || lower.includes('entity too large')
}

export function errorInfoFromKind(
  kind: AIErrorKind,
  message: string,
  rawMessage?: string
): ErrorInfo {
  // 413 is signalled in the provider body string; check before falling through to
  // the kind-based switch so the split-batch path still triggers.
  if (isPayloadTooLarge(rawMessage || message || '')) {
    return { type: '413', message, retryable: false, kind }
  }

  switch (kind) {
    case 'network':
    case 'timeout':
      return { type: kind, message, retryable: true, kind }
    case 'rate_limited':
    case 'upstream_rate_limited':
      // Transport already retried with backoff — don't re-retry here.
      return { type: '429', message, retryable: false, kind }
    case 'quota_exceeded':
      return { type: 'quota_exceeded', message, retryable: false, kind }
    case 'auth_failed':
    case 'cloudflare_blocked':
      return { type: '403', message, retryable: false, kind }
    case 'service_unavailable':
      return { type: 'service_unavailable', message, retryable: false, kind }
    case 'server_error':
    case 'bad_request':
      return { type: 'http', message, retryable: false, kind }
    case 'parse_failed':
      return { type: 'parse_failed', message, retryable: false, kind }
    case 'unknown':
    default:
      return { type: 'unknown', message, retryable: false, kind }
  }
}

export function parseMessageError(errorMessage: string): ErrorInfo {
  if (isPayloadTooLarge(errorMessage)) {
    return { type: '413', message: errorMessage, retryable: false }
  }
  const lower = errorMessage.toLowerCase()
  // Catch network errors thrown as plain Error objects (no errorKind available).
  if (
    lower.includes('network') ||
    lower.includes('econnreset') ||
    lower.includes('enotfound') ||
    lower.includes('econnaborted') ||
    lower.includes('etimedout') ||
    lower.includes('timeout')
  ) {
    return {
      type: lower.includes('timeout') ? 'timeout' : 'network',
      message: errorMessage,
      retryable: true
    }
  }
  for (const re of HTTP_CODE_REGEXES) {
    const match = errorMessage.match(re)
    if (match) {
      const httpCode = parseInt(match[1], 10)
      if (httpCode === 403) return { type: '403', message: errorMessage, retryable: false }
      if (httpCode === 429) return { type: '429', message: errorMessage, retryable: false }
      if (httpCode >= 400 && httpCode < 600) {
        return { type: 'http', message: errorMessage, retryable: false }
      }
    }
  }
  if (lower.includes('forbidden')) return { type: '403', message: errorMessage, retryable: false }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return { type: '429', message: errorMessage, retryable: false }
  }
  return { type: 'unknown', message: errorMessage, retryable: false }
}

// Parse a failure result from slideClassificationService (`{ success: false, error,
// errorKind? }`). Prefers typed `errorKind` when present.
export function parseResultError(result: {
  success: boolean
  error?: string
  errorKind?: AIErrorKind | string
}): ErrorInfo {
  const message = result.error || 'Unknown error'
  if (result.errorKind) {
    return errorInfoFromKind(result.errorKind as AIErrorKind, message, message)
  }
  return parseMessageError(message)
}

// Top-level entry for both thrown exceptions and result objects.
export function parseError(error: unknown): ErrorInfo {
  if (error && typeof error === 'object') {
    const maybe = error as { success?: boolean; error?: string; errorKind?: string }
    if ('success' in maybe || 'errorKind' in maybe) {
      return parseResultError(maybe as { success: boolean; error?: string; errorKind?: AIErrorKind })
    }
  }
  if (error instanceof Error) return parseMessageError(error.message)
  if (typeof error === 'string') return parseMessageError(error)
  return parseMessageError(String(error))
}

// Map an ErrorInfo to the UI banner shape used by usePostProcessing's
// `aiFilteringError` ref. The banner only renders a few discriminated states.
export function errorInfoToBanner(info: ErrorInfo): BannerError {
  switch (info.type) {
    case '403':
      return { type: '403', httpCode: 403, message: info.message }
    case '413':
      return { type: '413', httpCode: 413, message: info.message }
    case '429':
    case 'quota_exceeded':
      return { type: '429', httpCode: 429, message: info.message }
    case 'http':
    case 'service_unavailable':
    case 'parse_failed':
      return { type: 'http', message: info.message }
    case 'network':
    case 'timeout':
    case 'unknown':
    default:
      return { type: 'unknown', message: info.message }
  }
}

// Direct entry for B's parseAIError surface — preserved as a thin wrapper so the
// composable doesn't need to think about the intermediate ErrorInfo type.
export function parseBannerError(error: unknown): BannerError {
  return errorInfoToBanner(parseError(error))
}
