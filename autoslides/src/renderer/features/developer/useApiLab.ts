import { computed, reactive, ref, watch } from 'vue'

import { maskToken, type DevApiMethod, type DevApiPlatform, type DevApiResponse } from '@common/devApi'
import { tokenManager } from '@shared/services/authService'
import { configStore } from '@shared/services/configStore'
import { createLogger } from '@shared/utils/logger'
import { YANHE2, YANHE2_API_PRESETS, YANHE2_CODES, YANHE2_PRESET_GROUPS, isYanhe2OkCode } from './yanhe2ApiPresets'
import { CBIZ, CBIZ_CODES, PRESET_GROUPS, YANHEKT_API_PRESETS, presetUrl, type ApiPreset, type PresetGroup } from './yanhektApiPresets'

const log = createLogger('DeveloperApiLab')

/** `active`, `none`, `custom`, or `account:<badge>` for one stored account. */
export type TokenSource = string

export interface TokenOption {
  value: TokenSource
  /** Account name, or null for the fixed options (the page words those). */
  label: string | null
  /** Yanhekt: the masked token. Yanhe 2.0: null (the JWT stays in main). */
  masked: string | null
}

interface PlatformInfo {
  origin: string
  presets: readonly ApiPreset[]
  groups: readonly PresetGroup[]
  /** What the URL box starts on. */
  defaultPath: string
}

export const PLATFORMS: Readonly<Record<DevApiPlatform, PlatformInfo>> = {
  yanhekt: { origin: CBIZ, presets: YANHEKT_API_PRESETS, groups: PRESET_GROUPS, defaultPath: '/v1/user' },
  yanhe2: { origin: YANHE2, presets: YANHE2_API_PRESETS, groups: YANHE2_PRESET_GROUPS, defaultPath: '/userapi/v1/infosimple' },
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

export interface Envelope {
  code: string
  message: string
  meaning: string | null
  ok: boolean
}

type Obj = Record<string, unknown>

function isObj(value: unknown): value is Obj {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * The code that decides success, out of the aita envelopes in
 * docs/aita-yanhekt.md §3.2: `{code}`, `{success, result:{code}}`,
 * `{success, result:{err}}` and `{success, data:{code}}`.
 */
function yanhe2CodeOf(env: Obj): { code: unknown; message: string } | null {
  if ('success' in env && isObj(env.result)) {
    const r = env.result
    if ('err' in r) return { code: r.err, message: text(r.errMsg) }
    if ('code' in r) return { code: r.code, message: text(r.msg) }
  }
  if ('success' in env && isObj(env.data) && 'code' in env.data) {
    return { code: env.data.code, message: text(env.data.msg) }
  }
  if ('code' in env) return { code: env.code, message: text(env.msg) || text(env.message) }
  return null
}

/** `code` + its meaning when the body is one of the platform's envelopes. */
export function readEnvelope(body: string, platform: DevApiPlatform = 'yanhekt'): Envelope | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return null
  }
  if (!isObj(parsed)) return null
  if (platform === 'yanhe2') {
    const found = yanhe2CodeOf(parsed)
    if (!found) return null
    const code = String(found.code)
    return { code, message: found.message, meaning: YANHE2_CODES[code] ?? null, ok: isYanhe2OkCode(code) }
  }
  if (!('code' in parsed)) return null
  const code = String(parsed.code)
  return { code, message: text(parsed.message), meaning: CBIZ_CODES[code] ?? null, ok: code === '0' }
}

export function useApiLab() {
  const platform = ref<DevApiPlatform>('yanhekt')
  const platformInfo = computed(() => PLATFORMS[platform.value])
  const presets = computed(() => platformInfo.value.presets)
  const presetGroups = computed(() => platformInfo.value.groups)
  const presetId = ref<string | null>(null)
  const filter = ref('')

  const method = ref<DevApiMethod>('GET')
  const urlText = ref(`${CBIZ}/v1/user`)
  const params = ref<KeyValueRow[]>([])
  const headers = ref<KeyValueRow[]>([])
  const body = ref('')
  const requestTab = ref<RequestTab>('params')

  const tokenSource = ref<TokenSource>('active')
  // A cbiz token and an aita JWT are different things; each site keeps its own.
  const customTokens = reactive<Record<DevApiPlatform, string>>({ yanhekt: '', yanhe2: '' })
  const customToken = computed({
    get: () => customTokens[platform.value],
    set: (value: string) => { customTokens[platform.value] = value },
  })
  const clientHeaders = ref(true)

  const state = reactive({
    running: false,
    response: null as DevApiResponse | null,
    /** What the response belongs to, for the Sent tab. */
    sentPlatform: 'yanhekt' as DevApiPlatform,
    sentMethod: 'GET' as DevApiMethod,
    sentUrl: '',
    sentBody: '',
  })
  const responseTab = ref<ResponseTab>('body')

  const preset = computed<ApiPreset | null>(() => presets.value.find((p) => p.id === presetId.value) ?? null)

  const filteredPresets = computed(() => {
    const q = filter.value.trim().toLowerCase()
    if (!q) return presets.value
    return presets.value.filter((p) => p.path.toLowerCase().includes(q) || p.note.toLowerCase().includes(q) || p.method.toLowerCase() === q)
  })

  // tokenManager is not reactive; re-read it whenever the stored accounts change
  // (sign-in, sign-out, switch) and before each send.
  const activeAccountToken = ref<string | null>(tokenManager.getToken())
  const refreshActiveToken = () => { activeAccountToken.value = tokenManager.getToken() }
  watch(() => configStore.accounts, refreshActiveToken, { deep: true })

  // Yanhe 2.0 sessions are known by expiry only; re-read the clock on each send
  // and platform switch so an expired one stops being offered.
  const now = ref(Date.now())

  /** The signed-in account's badge (the account holding the active cbiz token). */
  const activeBadge = computed(() =>
    (configStore.accounts ?? []).find((a) => a.badge && a.token && a.token === activeAccountToken.value)?.badge ?? '',
  )

  function hasYanhe2Session(badge: string): boolean {
    return !!badge && (configStore.yanhe2SessionExpiry?.[badge] ?? 0) > now.value
  }

  const accountOptions = computed<TokenOption[]>(() => {
    const accounts = (configStore.accounts ?? []).filter((a) => a.badge && a.token)
    if (platform.value === 'yanhe2') {
      return accounts
        .filter((a) => hasYanhe2Session(a.badge))
        .map((a) => ({ value: `account:${a.badge}`, label: a.displayName || a.nickname || a.badge, masked: null }))
    }
    return accounts.map((a) => ({
      value: `account:${a.badge}`,
      label: a.displayName || a.nickname || a.badge,
      masked: maskToken(a.token),
    }))
  })

  /**
   * What the "signed-in account" option shows: the masked cbiz token, or for
   * Yanhe 2.0 the session's expiry time (the JWT is not in the renderer). Null
   * when there is nothing to send.
   */
  const activeTokenLabel = computed(() => {
    if (platform.value === 'yanhe2') {
      const badge = activeBadge.value
      if (!hasYanhe2Session(badge)) return null
      const expiry = new Date(configStore.yanhe2SessionExpiry[badge])
      return expiry.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    return activeAccountToken.value ? maskToken(activeAccountToken.value) : null
  })

  /** Yanhe 2.0: the badge whose stored JWT main should send, or ''. */
  function yanhe2AccountFor(source: TokenSource): string {
    const badge = source === 'active' ? activeBadge.value
      : source.startsWith('account:') ? source.slice('account:'.length)
        : ''
    return hasYanhe2Session(badge) ? badge : ''
  }

  function tokenFor(source: TokenSource): string | null {
    if (source === 'active') return activeAccountToken.value
    if (source === 'custom') return customToken.value.trim() || null
    if (source.startsWith('account:')) {
      const badge = source.slice('account:'.length)
      return configStore.accounts?.find((a) => a.badge === badge)?.token || null
    }
    return null
  }

  /** Whether the request will carry a token at all. */
  const hasToken = computed(() => {
    if (platform.value === 'yanhe2' && tokenSource.value !== 'custom') return !!yanhe2AccountFor(tokenSource.value)
    return !!tokenFor(tokenSource.value)
  })

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
    urlText.value = presetUrl(next, platformInfo.value.origin)
    body.value = next.body ?? ''
    requestTab.value = next.body ? 'body' : 'params'
    // An anonymous preset is most useful without a token; switch back when it needs one.
    if (next.auth === 'auth' && tokenSource.value === 'none') tokenSource.value = 'active'
  }

  /** Switch sites: its presets, its tokens, a fresh request line. */
  function setPlatform(next: DevApiPlatform) {
    if (next === platform.value) return
    platform.value = next
    now.value = Date.now()
    refreshActiveToken()
    presetId.value = null
    filter.value = ''
    method.value = 'GET'
    params.value = []
    body.value = ''
    requestTab.value = 'params'
    urlText.value = `${platformInfo.value.origin}${platformInfo.value.defaultPath}`
    state.response = null
    if (tokenSource.value.startsWith('account:') && !accountOptions.value.some((o) => o.value === tokenSource.value)) {
      tokenSource.value = 'active'
    }
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
    now.value = Date.now()
    const sentPlatform = platform.value
    const yanhe2 = sentPlatform === 'yanhe2'
    const source = tokenSource.value
    const sentMethod = method.value
    const sentUrl = urlText.value.trim()
    const sentBody = hasBody.value ? body.value : ''
    // Plain values only: a Vue proxy cannot cross IPC (Recurring #1).
    const request = JSON.parse(JSON.stringify({
      method: sentMethod,
      url: sentUrl,
      headers: headers.value.filter((h) => h.enabled && h.key.trim()).map((h) => ({ key: h.key, value: h.value })),
      body: sentBody,
      platform: sentPlatform,
      // Yanhe 2.0 accounts are sent by badge; main adds the stored JWT.
      token: yanhe2 && source !== 'custom' ? null : tokenFor(source),
      yanhe2Account: yanhe2 && source !== 'custom' ? yanhe2AccountFor(source) || null : null,
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
      state.sentPlatform = sentPlatform
      state.sentMethod = sentMethod
      state.sentUrl = sentUrl
      state.sentBody = sentBody
      state.running = false
    }
  }

  const envelope = computed(() => (state.response?.ok ? readEnvelope(state.response.body, state.sentPlatform) : null))

  const prettyBody = computed(() => {
    const res = state.response
    if (!res?.ok) return ''
    try {
      return JSON.stringify(JSON.parse(res.body), null, 2)
    } catch {
      return res.body
    }
  })

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch (error) {
      log.warn('Copy failed:', error)
    }
  }

  return {
    platform,
    setPlatform,
    platformOrigin: computed(() => platformInfo.value.origin),
    presetGroups,
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
    hasToken,
    state,
    responseTab,
    envelope,
    prettyBody,
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
