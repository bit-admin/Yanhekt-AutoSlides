/**
 * Optional hooks into the CAS flow, for Developer → SSO only.
 *
 * A probe sees each step before it runs (awaiting `beforeStep` pauses the
 * flow, throwing aborts it), decides whether the SMS goes out, and receives
 * every HTTP exchange the transport makes. Sign-in proper never passes one, so
 * none of this runs there.
 *
 * Exchanges arrive raw — cookies, the encrypted password, the SMS code. The
 * probe is responsible for redacting them before they go anywhere.
 */

import type { DevSsoStepId } from '@common/devSso';

/** The flow's steps, in the order they can run. */
export type CasStep = DevSsoStepId;

export interface CasExchange {
  method: string;
  url: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  requestBodyKind?: 'form' | 'json' | 'raw';
  status?: number;
  statusText?: string;
  responseHeaders?: Record<string, unknown>;
  responseBody?: string;
  /** Set when there was no HTTP answer. Log-safe. */
  error?: string;
  startedAt: number;
  durationMs: number;
}

export interface CasProbe {
  beforeStep(step: CasStep): Promise<void>;
  /** Before the SMS is sent. `skip` means a code already sent is still valid. */
  confirmSmsSend(phoneHint: string): Promise<'send' | 'skip'>;
  /** What the current step found (parsed page fields and the like). Values are display-safe. */
  note(fields: Record<string, string>): void;
  onExchange(exchange: CasExchange): void;
}
