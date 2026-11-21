import { effectScope } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useResultsView } from './useResultsView'

vi.mock('vue', async (importOriginal) => ({
  ...await importOriginal<typeof import('vue')>(), onMounted: vi.fn(), onUnmounted: vi.fn(),
}))
vi.mock('@shared/services/configStore', () => ({ configStore: { outputDirectory: '/out' } }))
vi.mock('@shared/autoCrop', () => ({ createAutoCropWorkerClient: () => ({}) }))
vi.mock('@shared/utils/logger', () => ({ createLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }))

afterEach(() => vi.unstubAllGlobals())

describe('Slides batch actions', () => {
  it('never expands an explicitly empty Clear Trash scope to the whole trash', async () => {
    const clear = vi.fn()
    const clearEntries = vi.fn()
    vi.stubGlobal('window', { electronAPI: { trash: { clear, clearEntries } } })
    const scope = effectScope()
    try {
      const view = scope.run(useResultsView)!
      await view.clearTrash([])
      expect(clear).not.toHaveBeenCalled()
      expect(clearEntries).not.toHaveBeenCalled()
    } finally {
      scope.stop()
    }
  })
})
