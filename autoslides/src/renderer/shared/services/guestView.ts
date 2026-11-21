import type { GuestEvent, GuestKind, GuestRect } from '@common/guestView'

type EventOf<T extends GuestEvent['type']> = GuestEvent & { type: T }

/** Renderer handle for one embedded site. Plain values only cross this API. */
export function createGuestClient(kind: GuestKind) {
  const api = () => window.electronAPI.guestView
  const listeners = new Set<(event: GuestEvent) => void>()
  const stop = api().onEvent((event) => {
    if (event.kind !== kind) return
    for (const listener of [...listeners]) listener(event)
  })

  const on = <T extends GuestEvent['type']>(type: T, callback: (event: EventOf<T>) => void) => {
    const listener = (event: GuestEvent) => {
      if (event.type === type) callback(event as EventOf<T>)
    }
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  return {
    kind,
    on,
    once<T extends GuestEvent['type']>(type: T): Promise<EventOf<T>> {
      return new Promise((resolve) => {
        const off = on(type, (event) => {
          off()
          resolve(event)
        })
      })
    },
    loadURL: (url: string) => api().navigate(kind, 'load', url),
    reload: () => api().navigate(kind, 'reload'),
    goBack: () => api().navigate(kind, 'back'),
    goForward: () => api().navigate(kind, 'forward'),
    getURL: () => api().getUrl(kind),
    send: (channel: string, payload?: unknown) => api().send(kind, channel, payload),
    executeJavaScript: <R = unknown>(code: string) => api().executeJavaScript(kind, code) as Promise<R>,
    focus: () => api().focus(kind),
    capturePage: (rect?: GuestRect) => api().capture(kind, rect),
    setOutline: (rect: GuestRect | null, color: string) => api().setOutline(kind, rect, color),
    dispose() {
      listeners.clear()
      stop()
    },
  }
}

export type GuestClient = ReturnType<typeof createGuestClient>
