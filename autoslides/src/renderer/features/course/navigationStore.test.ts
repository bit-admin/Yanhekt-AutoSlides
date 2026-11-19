import { beforeEach, describe, expect, it } from 'vitest'
import { navigationStore } from './navigationStore'
import { activateTab, closeTab, openPlaybackTab, tabStore } from './tabStore'

beforeEach(() => {
  for (const tab of [...tabStore.state.tabs]) closeTab(tab.id)
  navigationStore.navigate('home')
})

function openLectureTab() {
  const result = openPlaybackTab({
    mode: 'live',
    streamId: 'demo-stream',
    course: { id: 'demo-stream', title: '示例课程', instructor: '', time: '' },
    title: 'Test Lecture',
  })
  if (!result.ok) throw new Error('Could not open test playback tab')
  return result.tab.id
}

describe('Tools navigation', () => {
  it.each(['webcapture', 'yuketang'] as const)(
    'opens %s in the Info tab and only hides the right panel while it is in front',
    (target) => {
      const tabId = openLectureTab()
      navigationStore.setActivePinned('demo-pin')

      navigationStore.navigate(target)
      expect(navigationStore.activeNav.value).toBe(target)
      expect(navigationStore.activePinnedId.value).toBeNull()
      expect(tabStore.state.activeTabId).toBeNull()
      expect(navigationStore.isFullWidthPage.value).toBe(true)

      activateTab(tabId)
      expect(navigationStore.isFullWidthPage.value).toBe(false)
      activateTab(null)
      expect(navigationStore.isFullWidthPage.value).toBe(true)

      navigationStore.openSettings()
      expect(navigationStore.isFullWidthPage.value).toBe(false)
    },
  )
})
