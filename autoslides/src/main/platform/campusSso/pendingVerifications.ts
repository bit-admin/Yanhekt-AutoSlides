/**
 * Parking lot for second factors awaiting a code.
 *
 * A CAS second factor is a live server-side webflow: its cookies and
 * `execution` only stay valid for minutes, and they cannot be serialized and
 * rebuilt. So the handle stays right here in the main process and the renderer
 * only ever sees an opaque id — which also means an SMS challenge does not
 * survive a renderer reload, matching how the rest of the app treats in-memory
 * queues.
 *
 * Entries expire on their own; nothing here holds a timer, so an abandoned
 * challenge cannot keep the app awake.
 */
import { randomUUID } from 'node:crypto';
import type { SecondFactorHandle } from './casFlow';

/**
 * How long a parked challenge stays usable. CAS's own codes expire on a similar
 * scale, so a longer window would only produce confident-looking failures.
 */
export const CHALLENGE_LIFETIME_MS = 300_000;

interface ParkedChallenge {
  handle: SecondFactorHandle;
  expiresAt: number;
}

const parked = new Map<string, ParkedChallenge>();

export interface ChallengeTicket {
  challengeId: string;
  phoneHint: string;
  expiresInSeconds: number;
}

/** Park a handle and mint the id the renderer will quote back. */
export function parkChallenge(handle: SecondFactorHandle): ChallengeTicket {
  pruneExpired();
  const challengeId = randomUUID();
  parked.set(challengeId, { handle, expiresAt: Date.now() + CHALLENGE_LIFETIME_MS });
  return {
    challengeId,
    phoneHint: handle.phoneHint,
    expiresInSeconds: Math.floor(CHALLENGE_LIFETIME_MS / 1000),
  };
}

/**
 * Claim a parked challenge. Removes it either way: a code submission consumes
 * the flow, and a failed attempt leaves CAS's execution spent, so a retry has
 * to start from the password again.
 */
export function claimChallenge(challengeId: string): SecondFactorHandle | null {
  pruneExpired();
  const entry = parked.get(challengeId);
  if (!entry) return null;
  parked.delete(challengeId);
  return entry.handle;
}

/** Drop a challenge the user cancelled. */
export function abandonChallenge(challengeId: string): void {
  parked.delete(challengeId);
  pruneExpired();
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, entry] of parked) {
    if (entry.expiresAt <= now) parked.delete(id);
  }
}
