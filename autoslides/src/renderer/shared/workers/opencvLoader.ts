/**
 * Loads OpenCV.js into a worker from the one shared copy at `<output>/opencv/opencv.js`.
 *
 * The package is a single ~11 MB UMD script with its wasm inlined as base64.
 * Importing it from a worker makes Rollup put a full copy into that worker's
 * bundle, so the autoCrop and slideClassifier workers shipped it twice. Both now
 * load the same file at runtime instead:
 *
 * - Build: `vite.renderer.config.ts` copies the script to `opencv/` beside
 *   `assets/`. Built workers are classic workers (Vite's default `iife` format),
 *   so `importScripts` runs it and it sets `self.cv`.
 * - Dev: the dev server serves the same file at `/opencv/opencv.js`. Vite starts
 *   dev workers as module workers, where `importScripts` throws, so the script
 *   is fetched and run with an indirect (global, sloppy-mode) eval, which makes
 *   its `this` the worker global as `importScripts` would.
 */

const OPENCV_INIT_TIMEOUT_MS = 30_000

interface CvBox { cv: any }

let loading: Promise<CvBox> | null = null

function opencvScriptUrl(): string {
  if (import.meta.env.DEV) return '/opencv/opencv.js'
  // The worker runs from <output>/assets/<worker>.js under a file:// URL.
  return new URL('../opencv/opencv.js', self.location.href).href
}

async function runScript(url: string): Promise<void> {
  if (import.meta.env.DEV) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`OpenCV.js fetch failed: HTTP ${response.status}`)
    const source = await response.text()
    ;(0, eval)(source)
    return
  }
  ;(self as any).importScripts(url)
}

/**
 * The UMD wrapper sets `self.cv` to the Emscripten Module, which has a `then`
 * method that calls back with the Module itself. A promise that resolves with it,
 * including an async function that returns it, adopts it again forever (a
 * microtask loop that also starves timers). So the Module only ever travels
 * through promises inside a `{ cv }` box.
 */
async function resolveNamespace(candidate: any, log: (msg: string) => void): Promise<CvBox> {
  if (candidate && typeof candidate.then === 'function') {
    log('opencv shape: Emscripten thenable — waiting for runtime init…')
    return new Promise<CvBox>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`OpenCV.js init timed out (${OPENCV_INIT_TIMEOUT_MS / 1000} s)`)),
        OPENCV_INIT_TIMEOUT_MS,
      )
      candidate.then((initialised: any) => {
        clearTimeout(timer)
        resolve({ cv: initialised })
      })
    })
  }
  if (typeof candidate === 'function') {
    log('opencv shape: factory function — calling…')
    const result = candidate({})
    return (result && typeof result.then === 'function') ? resolveNamespace(result, log) : { cv: result }
  }
  return { cv: candidate }
}

/**
 * Loads and initialises OpenCV.js once per worker; later calls reuse it.
 * Resolves with `{ cv }`, never the bare namespace (see resolveNamespace).
 */
export function loadOpenCv(log: (msg: string) => void): Promise<CvBox> {
  if (!loading) {
    loading = (async () => {
      const url = opencvScriptUrl()
      log(`opencv loading from ${url}`)
      await runScript(url)
      const box = await resolveNamespace((self as any).cv, log)
      const cv = box.cv
      const ready =
        cv &&
        typeof cv.cvtColor === 'function' &&
        typeof cv.matFromImageData === 'function' &&
        typeof cv.resize === 'function' &&
        typeof cv.Mat === 'function'
      if (!ready) throw new Error('OpenCV.js initialised but cv namespace is incomplete')
      log('opencv ready')
      return box
    })()
    // A failed load may be retried by the next request.
    loading.catch(() => { loading = null })
  }
  return loading
}
