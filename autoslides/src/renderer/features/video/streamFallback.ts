/**
 * Moving on to another stream when the one on screen cannot be played. Shared
 * by the Yanhekt and Yanhe 2.0 players.
 *
 * A server can list a stream it does not have (Yanhe 2.0 answers 404 for some
 * screen MP4s, issue #39) or serve one with no video in it (Yanhekt's failed
 * transcodes). The player then switches to the next stream in the default
 * order instead of stopping on an error page.
 */
import type { ErrorData } from 'hls.js'
import { ErrorDetails, ErrorTypes } from 'hls.js'

export type FallbackStreamType = 'screen' | 'camera' | 'room'

/** Why a stream was given up on: not on the server, no video in it, or it broke. */
export type StreamFailureReason = 'missing' | 'empty' | 'failed'

export interface StreamFallbackNotice {
  from: FallbackStreamType
  to: FallbackStreamType
  reason: StreamFailureReason
}

/** The default order: screen first, like both players' first pick. */
export const STREAM_FALLBACK_ORDER: readonly FallbackStreamType[] = ['screen', 'camera', 'room']

/**
 * The first offered stream in the default order that has not failed, or null.
 * `offered` is what the selector lists (room only in developer mode).
 */
export function pickPlayableStream(
  offered: Iterable<FallbackStreamType>,
  failed: Iterable<FallbackStreamType>,
): FallbackStreamType | null {
  const have = new Set(offered)
  const dead = new Set(failed)
  return STREAM_FALLBACK_ORDER.find((type) => have.has(type) && !dead.has(type)) ?? null
}

/** An HTTP answer that means the file is not there. Retrying will not change it. */
export function isMissingStatus(status: number | undefined): boolean {
  return status === 404 || status === 410
}

/** A fatal hls.js error caused by the playlist itself answering 404 / 410. */
export function isMissingPlaylist(data: ErrorData): boolean {
  if (!data.fatal || data.type !== ErrorTypes.NETWORK_ERROR) return false
  if (data.details !== ErrorDetails.MANIFEST_LOAD_ERROR && data.details !== ErrorDetails.LEVEL_LOAD_ERROR) return false
  return isMissingStatus(data.response?.code)
}

/**
 * Whether a source the `<video>` element refused (native HLS or an MP4) is
 * simply not on the server. Ask for its first byte and read the status, with
 * a short timeout so a diagnostic never stalls fallback. Any other answer,
 * or none, is false.
 */
export async function isMissingMedia(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { Range: 'bytes=0-0' }, cache: 'no-store', signal: AbortSignal.timeout(5000),
    })
    void response.body?.cancel().catch(() => undefined)
    return isMissingStatus(response.status)
  } catch {
    return false
  }
}

/** The locale key of the notice shown after a switch. Takes `{ from, to }`. */
export function streamFallbackMessageKey(reason: StreamFailureReason): string {
  if (reason === 'missing') return 'playback.streamFallbackMissing'
  if (reason === 'empty') return 'playback.streamFallbackEmpty'
  return 'playback.streamFallback'
}
