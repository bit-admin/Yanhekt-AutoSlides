import { computed, reactive, ref, watch } from 'vue'

import { maskToken, type DevApiMethod, type DevApiResponse } from '@common/devApi'
import { tokenManager } from '@shared/services/authService'
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger'
import { CBIZ, CBIZ_CODES, YANHEKT_API_PRESETS, presetUrl, type ApiPreset } from './yanhektApiPresets'

const log = createLogger('DeveloperApiLab')

/** `active`, `none`, `custom`, or `account:<badge>` for one stored account. */
export type TokenSource = string

export interface TokenOption {
  value: TokenSource
  /** Account name, or null for the fixed options (the page words those). */
  label: string | null
  masked: string | null
}
export type ResponseTab = 'body' | 'headers' | 'request'
export type RequestTab = 'params' | 'headers' | 'body'

export interface KeyValueRow {
  key: string
  value: string
  enabled: boolean
  hint?: string
}

/** Split `a=1&b=2` into rows; tolerant of half-typed input. */
export function parseQuery(query: string): Array<{ key: string; value: string }> {
  if (!query) return []
  return query.split('&').filter(Boolean).map((part) => {
    const eq = part.indexOf('=')
    const rawKey = eq < 0 ? part : part.slice(0, eq)
    const rawValue = eq < 0 ? '' : part.slice(eq + 1)
    return { key: safeDecode(rawKey), value: safeDecode(rawValue) }
  })
}

function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '))
  } catch {
    return text
  }
}

/** `base?k=v…` from the enabled rows (keys without a name are dropped). */
export function buildUrl(base: string, rows: KeyValueRow[]): string {
  const query = rows
    .filter((r) => r.enabled && r.key.trim())
    .map((r) => `${encodeURIComponent(r.key.trim())}=${encodeURIComponent(r.value)}`)
    .join('&')
  return query ? `${base}?${query}` : base
}

/** `code` + its meaning when the body is a cbiz envelope. */
export function readEnvelope(body: string): { code: string; message: string; meaning: string | null } | null {
  try {
    const parsed = JSON.parse(body) as unknown
    if (!parsed || typeof parsed !== 'object' || !('code' in parsed)) return null
    const env = parsed as { code: unknown; message?: unknown }
    const code = String(env.code)
    return {
      code,
      message: typeof env.message === 'string' ? env.message : '',
      meaning: CBIZ_CODES[code] ?? null,
    }
  } catch {
    return null
  }
}

/** A shell command for the last request; the token is left as a variable. */
export function toCurl(method: DevApiMethod, url: string, headers: Record<string, string>, body: string): string {
  const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`
  const lines = [`curl -X ${method} ${quote(url)}`]
  for (const [key, value] of Object.entries(headers)) {
    const shown = key.toLowerCase() === 'authorization' ? 'Bearer $YANHEKT_TOKEN' : value
    lines.push(`  -H ${quote(`${key}: ${shown}`)}`)
  }
  if (method !== 'GET' && body.trim()) lines.push(`  --data-raw ${quote(body)}`)
  return lines.join(' \\\n')
}

export function useApiLab() {
  const presets = YANHEKT_API_PRESETS
  const presetId = ref<string | null>(null)
  const filter = ref('')

  const method = ref<DevApiMethod>('GET')
  const urlText = ref(`${CBIZ}/v1/user`)
  const params = ref<KeyValueRow[]>([])
  const headers = ref<KeyValueRow[]>([])
  const body = ref('')
  const requestTab = ref<RequestTab>('params')

  const tokenSource = ref<TokenSource>('active')
  const customToken = ref('')
  const clientHeaders = ref(true)

  const state = reactive({
    running: false,
    response: null as DevApiResponse | null,
    /** What the response belongs to, for cURL and the request tab. */
    sentMethod: 'GET' as DevApiMethod,
    sentUrl: '',
    sentBody: '',
  })
  const responseTab = ref<ResponseTab>('body')

  const preset = computed<ApiPreset | null>(() => presets.find((p) => p.id === presetId.value) ?? null)

  const filteredPresets = computed(() => {
    const q = filter.value.trim().toLowerCase()
    if (!q) return presets
    return presets.filter((p) => p.path.toLowerCase().includes(q) || p.note.toLowerCase().includes(q) || p.method.toLowerCase() === q)
  })

  // tokenManager is not reactive; re-read it whenever the stored accounts change
  // (sign-in, sign-out, switch) and before each send.
  const activeAccountToken = ref<string | null>(tokenManager.getToken())
  const refreshActiveToken = () => { activeAccountToken.value = tokenManager.getToken() }
  watch(() => configStore.accounts, refreshActiveToken, { deep: true })

  const accountOptions = computed<TokenOption[]>(() =>
    (configStore.accounts ?? [])
      .filter((a) => a.badge && a.token)
      .map((a) => ({
        value: `account:${a.badge}`,
        label: a.displayName || a.nickname || a.badge,
        masked: maskToken(a.token),
      })),
  )

  const activeTokenLabel = computed(() => (activeAccountToken.value ? maskToken(activeAccountToken.value) : null))

  function tokenFor(source: TokenSource): string | null {
    if (source === 'active') return activeAccountToken.value
    if (source === 'custom') return customToken.value.trim() || null
    if (source.startsWith('account:')) {
      const badge = source.slice('account:'.length)
      return configStore.accounts?.find((a) => a.badge === badge)?.token || null
    }
    return null
  }

  const activeToken = computed(() => tokenFor(tokenSource.value))

  const hasBody = computed(() => method.value !== 'GET')

  function hintFor(key: string): string | undefined {
    return preset.value?.params.find((p) => p.key === key)?.hint
  }

  /** The URL box changed: rebuild the enabled rows, keep the disabled ones. */
  function onUrlInput(text: string) {
    urlText.value = text
    const q = text.indexOf('?')
    const parsed = parseQuery(q < 0 ? '' : text.slice(q + 1))
    const disabled = params.value.filter((r) => !r.enabled)
    params.value = [
      ...parsed.map((p) => ({ ...p, enabled: true, hint: hintFor(p.key) })),
      ...disabled,
    ]
  }

  /** A param row changed: rewrite the URL box. */
  function syncUrlFromParams() {
    const q = urlText.value.indexOf('?')
    const base = q < 0 ? urlText.value : urlText.value.slice(0, q)
    urlText.value = buildUrl(base, params.value)
  }

  function addParam() {
    params.value.push({ key: '', value: '', enabled: true })
  }

  function removeParam(index: number) {
    params.value.splice(index, 1)
    syncUrlFromParams()
  }

  function addHeader() {
    headers.value.push({ key: '', value: '', enabled: true })
  }

  function removeHeader(index: number) {
    headers.value.splice(index, 1)
  }

  function applyPreset(next: ApiPreset) {
    presetId.value = next.id
    method.value = next.method
    params.value = next.params.map((p) => ({ key: p.key, value: p.value, enabled: true, hint: p.hint }))
    urlText.value = presetUrl(next)
    body.value = next.body ?? ''
    requestTab.value = next.body ? 'body' : 'params'
    // An anonymous preset is most useful without a token; switch back when it needs one.
    if (next.auth === 'auth' && tokenSource.value === 'none') tokenSource.value = 'active'
  }

  function setMethod(next: DevApiMethod) {
    method.value = next
    if (next !== 'GET' && requestTab.value === 'params' && !params.value.length) requestTab.value = 'body'
  }

  const bodyError = computed(() => {
    if (!hasBody.value || !body.value.trim()) return null
    try {
      JSON.parse(body.value)
      return null
    } catch (error) {
      return error instanceof Error ? error.message : String(error)
    }
  })

  function formatBody() {
    if (bodyError.value || !body.value.trim()) return
    body.value = JSON.stringify(JSON.parse(body.value), null, 2)
  }

  async function send() {
    if (state.running) return
    state.running = true
    refreshActiveToken()
    const sentMethod = method.value
    const sentUrl = urlText.value.trim()
    const sentBody = hasBody.value ? body.value : ''
    // Plain values only: a Vue proxy cannot cross IPC (Recurring #1).
    const request = JSON.parse(JSON.stringify({
      method: sentMethod,
      url: sentUrl,
      headers: headers.value.filter((h) => h.enabled && h.key.trim()).map((h) => ({ key: h.key, value: h.value })),
      body: sentBody,
      token: tokenFor(tokenSource.value),
      clientHeaders: clientHeaders.value,
    }))
    try {
      state.response = await window.electronAPI.api.devSend(request)
    } catch (error) {
      log.warn('Request failed:', error)
      state.response = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0,
        sentHeaders: {},
      }
    } finally {
      state.sentMethod = sentMethod
      state.sentUrl = sentUrl
      state.sentBody = sentBody
      state.running = false
    }
  }

  const envelope = computed(() => (state.response?.ok ? readEnvelope(state.response.body) : null))

  const prettyBody = computed(() => {
    const res = state.response
    if (!res?.ok) return ''
    try {
      return JSON.stringify(JSON.parse(res.body), null, 2)
    } catch {
      return res.body
    }
  })

  const curl = computed(() =>
    state.response ? toCurl(state.sentMethod, state.sentUrl, state.response.sentHeaders, state.sentBody) : '',
  )

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      log.warn('Copy failed:', error)
    }
  }

  return {
    presets,
    filteredPresets,
    filter,
    preset,
    presetId,
    method,
    urlText,
    params,
    headers,
    body,
    bodyError,
    hasBody,
    requestTab,
    tokenSource,
    customToken,
    clientHeaders,
    activeTokenLabel,
    accountOptions,
    activeToken,
    state,
    responseTab,
    envelope,
    prettyBody,
    curl,
    applyPreset,
    setMethod,
    onUrlInput,
    syncUrlFromParams,
    addParam,
    removeParam,
    addHeader,
    removeHeader,
    formatBody,
    send,
    copy,
  }
}
