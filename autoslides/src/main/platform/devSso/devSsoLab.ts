/**
 * Developer → SSO: one campus CAS sign-in at a time, run through the real flow
 * (campusSso/casFlow.ts) with a probe that can hold it before any step.
 *
 * - Pause takes effect before the next step; a request already sent finishes.
 * - The SMS never goes out on its own: the run stops at `awaiting_sms_send`
 *   until the developer sends it, or says a code already sent is still good.
 * - Nothing is stored. Trusted-device cookies are read (when asked) but never
 *   written, and the run lives only in memory.
 * - Secrets are masked in every snapshot unless raw values are switched on
 *   (`setReveal`). The raw exchanges and tokens of the current run are kept
 *   here so the switch works in both directions at any time.
 *
 * A held run holds no timer; CAS simply expires the flow if it waits too long,
 * and the next step shows CAS's answer.
 */
import { maskToken } from '@common/devApi';
import type {
  DevSsoControl,
  DevSsoSnapshot,
  DevSsoStartRequest,
  DevSsoStep,
  DevSsoTarget,
} from '@common/devSso';
import type { ConfigService } from '@main/platform/configService';
import { CasSignInError, finishSecondFactor, startPasswordSignIn, type SecondFactorHandle, type SignInTokens } from '@main/platform/campusSso/casFlow';
import type { CasExchange, CasProbe, CasStep } from '@main/platform/campusSso/casProbe';
import { describeErrorSafely } from '@main/platform/campusSso/casDiagnostics';
import type { DurableCookie } from '@main/platform/campusSso/casTransport';
import { formatExchange } from './devSsoRedact';

/** Thrown into the flow when the developer stops the run. */
class LabStopped extends Error {
  constructor() {
    super('Stopped.');
    this.name = 'LabStopped';
  }
}

interface Waiter<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

function emptySnapshot(storedTrustedCookies: number): DevSsoSnapshot {
  return {
    runId: 0,
    status: 'idle',
    reveal: false,
    stepMode: false,
    pauseRequested: false,
    target: 'yanhekt',
    startedAt: null,
    finishedAt: null,
    seededCookies: 0,
    storedTrustedCookies,
    phoneHint: '',
    steps: [],
    result: null,
    error: null,
  };
}

export class DevSsoLab {
  private snap: DevSsoSnapshot;
  private stopped = false;
  private stepWaiter: Waiter<void> | null = null;
  private smsWaiter: Waiter<'send' | 'skip'> | null = null;
  private handle: SecondFactorHandle | null = null;
  private exchangeId = 0;
  private reveal = false;
  private readonly rawExchanges = new Map<number, CasExchange>();
  private rawResult: { tokens: SignInTokens; durableCookies: DurableCookie[] } | null = null;
  private readonly listeners = new Set<(snapshot: DevSsoSnapshot) => void>();

  constructor(
    private readonly configService: ConfigService,
    private readonly isEnabled: () => boolean,
  ) {
    this.snap = emptySnapshot(0);
  }

  subscribe(listener: (snapshot: DevSsoSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  snapshot(): DevSsoSnapshot {
    const base = { ...this.snap, reveal: this.reveal, storedTrustedCookies: this.storedCookies().length };
    if (!this.reveal) return base;
    const raw = this.rawResult;
    return {
      ...base,
      steps: base.steps.map((step) => ({
        ...step,
        exchanges: step.exchanges.map((ex) => {
          const original = this.rawExchanges.get(ex.id);
          return original ? formatExchange(original, ex.id, true) : ex;
        }),
      })),
      result: base.result && raw
        ? {
            yanhekt: raw.tokens.yanhekt ?? null,
            yanhe2: raw.tokens.yanhe2 ?? null,
            durableCookies: raw.durableCookies.map(({ name, host, expiresAt, value }) => ({ name, host, expiresAt, value })),
          }
        : base.result,
    };
  }

  /** Show secrets unmasked (or mask them again) for the current and later runs. */
  setReveal(on: boolean): DevSsoSnapshot {
    this.assertEnabled();
    this.reveal = on === true;
    this.update({});
    return this.snapshot();
  }

  start(request: DevSsoStartRequest): DevSsoSnapshot {
    this.assertEnabled();
    const username = typeof request?.username === 'string' ? request.username.trim() : '';
    const password = typeof request?.password === 'string' ? request.password : '';
    if (!username || !password) throw new Error('Enter a username and password.');
    const target: DevSsoTarget = request.target === 'yanhe2' || request.target === 'both' ? request.target : 'yanhekt';

    this.abandon();
    const seed = request.useTrustedDevice ? this.storedCookies() : [];
    const runId = this.snap.runId + 1;
    this.stopped = false;
    this.rawExchanges.clear();
    this.rawResult = null;
    this.snap = {
      ...emptySnapshot(0),
      runId,
      status: 'running',
      stepMode: !!request.stepMode,
      target,
      startedAt: Date.now(),
      seededCookies: seed.length,
    };

    const options = target === 'yanhe2'
      ? { target: 'yanhe2' as const }
      : { target: 'yanhekt' as const, alsoYanhe2: target === 'both' };
    void this.drive(runId, async () => {
      const outcome = await startPasswordSignIn(username, password, seed, options, this.probe(runId));
      if (outcome.kind === 'signed_in') return { tokens: outcome.tokens, durableCookies: outcome.durableCookies };
      this.handle = outcome.handle;
      this.snap.phoneHint = outcome.handle.phoneHint;
      this.markCurrent('done');
      this.update({ status: 'awaiting_code' });
      return null;
    });
    return this.snapshot();
  }

  control(action: DevSsoControl): DevSsoSnapshot {
    this.assertEnabled();
    switch (action) {
      case 'pause':
        if (this.snap.status === 'running') this.update({ pauseRequested: true });
        break;
      case 'resume':
        this.update({ stepMode: false, pauseRequested: false });
        this.release();
        break;
      case 'step':
        this.update({ stepMode: true, pauseRequested: false });
        this.release();
        break;
      case 'stop':
        this.abandon();
        break;
    }
    return this.snapshot();
  }

  /** Answer the SMS gate: send the code now, or use one already sent. */
  sendSms(decision: 'send' | 'skip'): DevSsoSnapshot {
    this.assertEnabled();
    const waiter = this.smsWaiter;
    if (!waiter || this.snap.status !== 'awaiting_sms_send') throw new Error('The run is not waiting to send a code.');
    this.smsWaiter = null;
    this.snap.steps.at(-1)!.notes.decision = decision === 'send' ? 'Send a code' : 'Use a code already sent';
    this.update({ status: 'running' });
    waiter.resolve(decision);
    return this.snapshot();
  }

  submitCode(code: string): DevSsoSnapshot {
    this.assertEnabled();
    const value = typeof code === 'string' ? code.trim() : '';
    const handle = this.handle;
    if (!handle || this.snap.status !== 'awaiting_code') throw new Error('The run is not waiting for a code.');
    if (!value) throw new Error('Enter the code.');
    // CAS spends the flow on a submission either way, like sign-in proper.
    this.handle = null;
    const runId = this.snap.runId;
    this.update({ status: 'running' });
    void this.drive(runId, () => finishSecondFactor(handle, value));
    return this.snapshot();
  }

  /** Run one leg of the flow; settles the snapshot unless the run was replaced or stopped. */
  private async drive(
    runId: number,
    leg: () => Promise<{ tokens: SignInTokens; durableCookies: DurableCookie[] } | null>,
  ): Promise<void> {
    try {
      const done = await leg();
      if (runId !== this.snap.runId || this.stopped || !done) return;
      this.rawResult = done;
      this.markCurrent('done');
      this.update({
        status: 'succeeded',
        finishedAt: Date.now(),
        result: {
          yanhekt: done.tokens.yanhekt ? maskToken(done.tokens.yanhekt) : null,
          yanhe2: done.tokens.yanhe2 ? maskToken(done.tokens.yanhe2) : null,
          durableCookies: done.durableCookies.map(({ name, host, expiresAt }) => ({ name, host, expiresAt, value: null })),
        },
      });
    } catch (error) {
      if (runId !== this.snap.runId || this.stopped || error instanceof LabStopped) return;
      this.markCurrent('failed');
      this.update({
        status: 'failed',
        finishedAt: Date.now(),
        error: error instanceof CasSignInError
          ? { reason: error.reason, message: error.message }
          : { reason: 'network', message: describeErrorSafely(error) },
      });
    }
  }

  private probe(runId: number): CasProbe {
    const live = () => runId === this.snap.runId && !this.stopped;
    return {
      beforeStep: async (step: CasStep) => {
        if (!live()) throw new LabStopped();
        const last = this.snap.steps.at(-1);
        // The SMS step was opened at its gate, and clicking Send was the go-ahead.
        const confirmed = step === 'send_sms' && last?.id === 'send_sms' && last.state === 'waiting';
        let entry: DevSsoStep;
        if (confirmed) {
          entry = last;
        } else {
          this.markCurrent('done');
          entry = { id: step, state: 'waiting', reachedAt: Date.now(), notes: {}, exchanges: [] };
          this.snap.steps.push(entry);
        }
        if (!confirmed && (this.snap.stepMode || this.snap.pauseRequested)) {
          this.update({ status: 'paused', pauseRequested: false });
          await new Promise<void>((resolve, reject) => { this.stepWaiter = { resolve, reject }; });
          if (!live()) throw new LabStopped();
        }
        entry.state = 'running';
        this.update({ status: 'running' });
      },
      confirmSmsSend: (phoneHint: string) => {
        if (!live()) return Promise.reject(new LabStopped());
        this.markCurrent('done');
        this.snap.steps.push({ id: 'send_sms', state: 'waiting', reachedAt: Date.now(), notes: {}, exchanges: [] });
        this.update({ status: 'awaiting_sms_send', phoneHint });
        // On `send` the flow's own send_sms step picks this entry up; on `skip` it stays as the record.
        return new Promise<'send' | 'skip'>((resolve, reject) => { this.smsWaiter = { resolve, reject }; });
      },
      note: (fields: Record<string, string>) => {
        if (!live()) return;
        const step = this.snap.steps.at(-1);
        if (!step) return;
        Object.assign(step.notes, fields);
        this.update({});
      },
      onExchange: (exchange: CasExchange) => {
        if (!live()) return;
        const step = this.snap.steps.at(-1);
        if (!step) return;
        const id = ++this.exchangeId;
        this.rawExchanges.set(id, exchange);
        step.exchanges.push(formatExchange(exchange, id));
        this.update({});
      },
    };
  }

  private markCurrent(state: 'done' | 'failed'): void {
    const step = this.snap.steps.at(-1);
    if (step && (step.state === 'running' || step.state === 'waiting')) step.state = state;
  }

  private release(): void {
    const waiter = this.stepWaiter;
    this.stepWaiter = null;
    waiter?.resolve();
  }

  /** End the current run, wherever it is. */
  private abandon(): void {
    const active = ['running', 'paused', 'awaiting_sms_send', 'awaiting_code'].includes(this.snap.status);
    this.stopped = true;
    this.handle = null;
    const step = this.stepWaiter;
    const sms = this.smsWaiter;
    this.stepWaiter = null;
    this.smsWaiter = null;
    step?.reject(new LabStopped());
    sms?.reject(new LabStopped());
    if (active) {
      const current = this.snap.steps.at(-1);
      if (current && current.state !== 'done') current.state = 'failed';
      this.update({ status: 'stopped', finishedAt: Date.now(), pauseRequested: false });
    }
  }

  private update(patch: Partial<DevSsoSnapshot>): void {
    Object.assign(this.snap, patch);
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A closed window must not break the run.
      }
    }
  }

  private storedCookies(): DurableCookie[] {
    try {
      return this.configService.getSsoDeviceCookies();
    } catch {
      return [];
    }
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) throw new Error('Developer mode is off.');
  }
}
