// Unified AI-error classification for the pipeline and the UI.
// Ported from autoslides/src/renderer/shared/postProcessing/errorModel.ts,
// minus the 413 payload-split and ModelScope quota branches (web is
// single-image only, no batch endpoint to split).
//
// Cardinal rule preserved from desktop: the transport (llmClient) already
// retries `rate_limited` / `upstream_rate_limited` with backoff, so those are
// retryable=false here. Only `network` and `timeout` are pipeline-retryable.

import type { AIErrorKind } from './types'

export type ErrorType =
  | 'network'
  | 'timeout'
  | '403'
  | '429'
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

const HTTP_CODE_REGEXES: RegExp[] = [
  /HTTP\s*(\d{3})/i,
  /status[:\s]*(\d{3})/i,
  /(\d{3})/
]

export function errorInfoFromKind(kind: AIErrorKind, message: string): ErrorInfo {
  switch (kind) {
    case 'network':
    case 'timeout':
      return { type: kind, message, retryable: true, kind }
    case 'rate_limited':
    case 'upstream_rate_limited':
      // Transport already retried with backoff — don't re-retry here.
      return { type: '429', message, retryable: false, kind }
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
  const lower = errorMessage.toLowerCase()
  // Catch network errors thrown as plain Error objects (no errorKind available).
  if (
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
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

// Parse a failure result from the classifier (`{ success: false, error,
// errorKind? }`). Prefers the typed `errorKind` when present.
export function parseResultError(result: {
  success: boolean
  error?: string
  errorKind?: AIErrorKind | string
}): ErrorInfo {
  const message = result.error || 'Unknown error'
  if (result.errorKind) {
    return errorInfoFromKind(result.errorKind as AIErrorKind, message)
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
