import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { DevSsoControl, DevSsoExchange, DevSsoSnapshot, DevSsoStatus, DevSsoStep, DevSsoTarget } from '@common/devSso'
import { createLogger } from '@shared/utils/logger'

const log = createLogger('DeveloperSsoLab')

export const ACTIVE_STATUSES: readonly DevSsoStatus[] = ['running', 'paused', 'awaiting_sms_send', 'awaiting_code']

/** The run as plain text for a bug report. Main already redacted it. */
export function snapshotReport(snapshot: DevSsoSnapshot): string {
  return JSON.stringify(snapshot, null, 2)
}

/** The latest request, or the latest step when it has none yet. */
export function latestSelection(list: DevSsoStep[]): { step: number; exchange: number | null } | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const last = list[i].exchanges.at(-1)
    if (last) return { step: i, exchange: last.id }
  }
  return list.length ? { step: list.length - 1, exchange: null } : null
}

export function useSsoLab() {
  const snapshot = ref<DevSsoSnapshot | null>(null)
  const username = ref('')
  const password = ref('')
  const target = ref<DevSsoTarget>('yanhekt')
  const useTrustedDevice = ref(true)
  const stepMode = ref(true)
  const code = ref('')
  const busy = ref(false)
  const error = ref<string | null>(null)
  const savedLogins = ref<Array<{ badge: string; username: string }>>([])

  const status = computed<DevSsoStatus>(() => snapshot.value?.status ?? 'idle')
  const active = computed(() => ACTIVE_STATUSES.includes(status.value))
  const steps = computed(() => snapshot.value?.steps ?? [])

  /** The picked step (its index in the run) and, optionally, one of its requests. */
  const selection = ref<{ step: number; exchange: number | null } | null>(null)
  // Follow the newest request until something is picked by hand in this run.
  let followLatest = true
  let lastRunId = 0

  const selectedStep = computed<DevSsoStep | null>(() => {
    const index = selection.value?.step
    return index === undefined ? null : steps.value[index] ?? null
  })

  const selectedExchange = computed<DevSsoExchange | null>(() => {
    const id = selection.value?.exchange
    if (id == null) return null
    return selectedStep.value?.exchanges.find((e) => e.id === id) ?? null
  })

  function apply(next: DevSsoSnapshot) {
    snapshot.value = next
    if (next.runId !== lastRunId) {
      lastRunId = next.runId
      selection.value = null
      followLatest = true
    }
    if (followLatest) selection.value = latestSelection(next.steps)
    if (next.stepMode !== stepMode.value && ACTIVE_STATUSES.includes(next.status)) stepMode.value = next.stepMode
  }

  function selectStep(step: number) {
    selection.value = { step, exchange: null }
    followLatest = false
  }

  function selectExchange(step: number, exchange: number) {
    selection.value = { step, exchange }
    followLatest = false
  }

  let unsubscribe: (() => void) | null = null

  async function call(run: () => Promise<DevSsoSnapshot>) {
    if (busy.value) return
    busy.value = true
    error.value = null
    try {
      apply(await run())
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      log.warn('SSO lab call failed:', error.value)
    } finally {
      busy.value = false
    }
  }

  function start() {
    // Plain values only: a Vue proxy cannot cross IPC (Recurring #1).
    const request = JSON.parse(JSON.stringify({
      username: username.value.trim(),
      password: password.value,
      target: target.value,
      useTrustedDevice: useTrustedDevice.value,
      stepMode: stepMode.value,
    }))
    code.value = ''
    return call(() => window.electronAPI.auth.devSsoStart(request))
  }

  const control = (action: DevSsoControl) => call(() => window.electronAPI.auth.devSsoControl(action))
  const sendSms = (decision: 'send' | 'skip') => call(() => window.electronAPI.auth.devSsoSendSms(decision))
  const reveal = computed(() => snapshot.value?.reveal ?? false)
  const setReveal = (on: boolean) => call(() => window.electronAPI.auth.devSsoSetReveal(on))

  function submitCode() {
    const value = code.value.trim()
    if (!value) return
    code.value = ''
    return call(() => window.electronAPI.auth.devSsoSubmitCode(value))
  }

  /** Pause-before-each-step, changed mid-run: Step keeps it on, Pause/Resume set it. */
  function setStepMode(on: boolean) {
    stepMode.value = on
    if (!active.value) return
    if (on && status.value === 'running') return control('pause').then(() => control('step'))
    if (!on && status.value === 'paused') return control('resume')
  }

  async function fillSavedLogin(badge: string) {
    if (!badge) return
    try {
      const saved = await window.electronAPI.auth.getSavedLogin(badge)
      if (saved) {
        username.value = saved.username
        password.value = saved.password
      }
    } catch (err) {
      log.warn('Could not read the saved login:', err)
    }
  }

  async function copyReport() {
    if (!snapshot.value) return
    try {
      await navigator.clipboard.writeText(snapshotReport(snapshot.value))
    } catch (err) {
      log.warn('Copy failed:', err)
    }
  }

  onMounted(async () => {
    unsubscribe = window.electronAPI.auth.onDevSsoUpdate(apply)
    try {
      apply(await window.electronAPI.auth.devSsoState())
      savedLogins.value = await window.electronAPI.auth.listSavedLogins()
    } catch (err) {
      log.warn('Could not load the SSO lab state:', err)
    }
  })

  onBeforeUnmount(() => {
    unsubscribe?.()
    unsubscribe = null
  })

  return {
    snapshot,
    username,
    password,
    target,
    useTrustedDevice,
    stepMode,
    code,
    busy,
    error,
    status,
    active,
    steps,
    savedLogins,
    selection,
    selectedStep,
    selectedExchange,
    selectStep,
    selectExchange,
    start,
    control,
    sendSms,
    submitCode,
    setStepMode,
    reveal,
    setReveal,
    fillSavedLogin,
    copyReport,
  }
}
