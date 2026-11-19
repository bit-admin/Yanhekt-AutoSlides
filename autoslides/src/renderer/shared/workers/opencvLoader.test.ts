import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A stand-in for the Emscripten Module OpenCV.js puts on `self.cv`: its `then`
 * calls back with the Module itself, so resolving a promise with it never ends.
 */
function fakeEmscriptenModule(complete = true) {
  const module: Record<string, unknown> = {}
  module.then = (fn: (m: unknown) => void) => {
    Object.assign(module, complete ? {
      cvtColor: () => {},
      matFromImageData: () => {},
      resize: () => {},
      Mat: function Mat() {},
    } : {})
    queueMicrotask(() => fn(module))
    return module
  }
  return module
}

describe('loadOpenCv', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('self', globalThis)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete (globalThis as Record<string, unknown>).__fakeCv
    delete (globalThis as Record<string, unknown>).cv
  })

  function serveScript(module: unknown) {
    ;(globalThis as Record<string, unknown>).__fakeCv = module
    const fetchMock = vi.fn(async () => new Response('self.cv = globalThis.__fakeCv'))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('resolves with a boxed namespace even though the Module is a self-adopting thenable', async () => {
    const module = fakeEmscriptenModule()
    const fetchMock = serveScript(module)
    const { loadOpenCv } = await import('./opencvLoader')

    const box = await loadOpenCv(() => {})
    expect(box.cv).toBe(module)
    expect(fetchMock).toHaveBeenCalledWith('/opencv/opencv.js')

    // Loaded once per worker.
    await loadOpenCv(() => {})
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects an incomplete namespace and lets the next call retry', async () => {
    const fetchMock = serveScript(fakeEmscriptenModule(false))
    const { loadOpenCv } = await import('./opencvLoader')

    await expect(loadOpenCv(() => {})).rejects.toThrow(/incomplete/)
    ;(globalThis as Record<string, unknown>).__fakeCv = fakeEmscriptenModule()
    await expect(loadOpenCv(() => {})).resolves.toHaveProperty('cv')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
