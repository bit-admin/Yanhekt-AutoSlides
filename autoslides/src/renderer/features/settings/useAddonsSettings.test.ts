import { afterEach, expect, it, vi } from 'vitest'
import { useAddonsSettings } from './useAddonsSettings'

afterEach(() => vi.unstubAllGlobals())

function setup(shareTimeline?: boolean) {
  const get = vi.fn(async () => ({ cloudShareEmbedTimeline: shareTimeline }))
  const setCloudShareEmbedTimeline = vi.fn(async (enabled: boolean) => {
    shareTimeline = enabled
    return get()
  })
  vi.stubGlobal('window', { electronAPI: {
    config: { get, setCloudShareEmbedTimeline },
    notionNotes: { getToken: async () => null },
  } })
  return { settings: useAddonsSettings(), setCloudShareEmbedTimeline }
}

it('loads the saved Share Timeline option and discards unsaved changes', async () => {
  const { settings, setCloudShareEmbedTimeline } = setup(false)
  await settings.load()
  expect(settings.tempCloudShareEmbedTimeline.value).toBe(false)

  settings.tempCloudShareEmbedTimeline.value = true
  settings.resetTemp()
  expect(settings.tempCloudShareEmbedTimeline.value).toBe(false)
  await settings.save()
  expect(setCloudShareEmbedTimeline).not.toHaveBeenCalled()
})

it('defaults to checked and writes the Share Timeline option only on Save', async () => {
  const { settings, setCloudShareEmbedTimeline } = setup()
  await settings.load()
  expect(settings.tempCloudShareEmbedTimeline.value).toBe(true)

  settings.tempCloudShareEmbedTimeline.value = false
  expect(setCloudShareEmbedTimeline).not.toHaveBeenCalled()
  await settings.save()
  expect(setCloudShareEmbedTimeline).toHaveBeenCalledExactlyOnceWith(false)
  await settings.load()
  expect(settings.tempCloudShareEmbedTimeline.value).toBe(false)
})
