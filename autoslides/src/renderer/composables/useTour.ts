import { ref } from 'vue'
import { driver } from 'driver.js'
import type { Driver } from 'driver.js'
import { useI18n } from 'vue-i18n'

// Import Driver.js CSS
import 'driver.js/dist/driver.css'

const tourInstance = ref<Driver | null>(null)
const isFirstVisit = ref(true)
const isDemoMode = ref(false)
const originalTheme = ref<string | null>(null)

export function useTour() {
  const { t } = useI18n()

  // Theme management functions
  const saveCurrentTheme = async () => {
    try {
      const currentTheme = await window.electronAPI.config.getThemeMode()
      originalTheme.value = currentTheme
    } catch (error) {
      console.error('Failed to get current theme:', error)
    }
  }

  const setLightMode = async () => {
    try {
      await window.electronAPI.config.setThemeMode('light')
    } catch (error) {
      console.error('Failed to set light mode:', error)
    }
  }

  const restoreOriginalTheme = async () => {
    if (originalTheme.value) {
      try {
        await window.electronAPI.config.setThemeMode(originalTheme.value)
        originalTheme.value = null
      } catch (error) {
        console.error('Failed to restore original theme:', error)
      }
    }
  }

  const initializeTour = async () => {
    if (tourInstance.value) {
      tourInstance.value.destroy()
    }

    // Save current theme and switch to light mode
    await saveCurrentTheme()
    await setLightMode()

    // Enable demo mode when starting tour
    isDemoMode.value = true

    // Emit event to switch to demo mode and ensure demo starts in login state
    window.dispatchEvent(new CustomEvent('tour-demo-mode', { detail: { enabled: true } }))

    // Wait a bit for demo mode to be enabled and DOM to update
    setTimeout(() => {
      tourInstance.value = driver({
        showProgress: true,
        allowClose: true,
        overlayClickNext: false,
        steps: [
          {
            element: '.login-section',
            popover: {
              title: t('tour.steps.loginSection.title'),
              description: t('tour.steps.loginSection.description'),
              side: 'right',
              align: 'start'
            }
          },
          {
            element: '.left-panel',
            popover: {
              title: t('tour.steps.leftPanel.title'),
              description: t('tour.steps.leftPanel.description'),
              side: 'right',
              align: 'center'
            }
          },
          {
            element: '.connection-mode-setting',
            popover: {
              title: t('tour.steps.connectionMode.title'),
              description: t('tour.steps.connectionMode.description'),
              side: 'right',
              align: 'start'
            }
          },
          {
            element: '.navigation-bar',
            popover: {
              title: t('tour.steps.modeSwitch.title'),
              description: t('tour.steps.modeSwitch.description'),
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: '.controls-section',
            popover: {
              title: t('tour.steps.searchRow.title'),
              description: t('tour.steps.searchRow.description'),
              side: 'bottom',
              align: 'start'
            }
          },
          {
            element: '#tour-course-list',
            popover: {
              title: t('tour.steps.courseList.title'),
              description: t('tour.steps.courseList.description'),
              side: 'top',
              align: 'center'
            }
          },
          {
            element: '#tour-sessions-container',
            popover: {
              title: t('tour.steps.sessionsContainer.title'),
              description: t('tour.steps.sessionsContainer.description'),
              side: 'top',
              align: 'center'
            }
          },
          {
            element: '#tour-batch-actions',
            popover: {
              title: t('tour.steps.batchActions.title'),
              description: t('tour.steps.batchActions.description'),
              side: 'bottom',
              align: 'center'
            }
          },
          {
            element: '.right-panel[data-tab="task"]',
            popover: {
              title: t('tour.steps.rightPanelTask.title'),
              description: t('tour.steps.rightPanelTask.description'),
              side: 'left',
              align: 'center'
            }
          },
          {
            element: '.right-panel[data-tab="download"]',
            popover: {
              title: t('tour.steps.rightPanelDownload.title'),
              description: t('tour.steps.rightPanelDownload.description'),
              side: 'left',
              align: 'center'
            }
          },
          {
            element: '.content',
            popover: {
              title: t('tour.steps.playbackContent.title'),
              description: t('tour.steps.playbackContent.description'),
              side: 'top',
              align: 'center'
            }
          },
          {
            element: '.slide-gallery',
            popover: {
              title: t('tour.steps.slideGallery.title'),
              description: t('tour.steps.slideGallery.description'),
              side: 'top',
              align: 'center'
            }
          },
          {
            element: '.search-box',
            popover: {
              title: t('tour.steps.searchButton.title'),
              description: t('tour.steps.searchButton.description'),
              side: 'bottom',
              align: 'center'
            }
          }
        ],
        onNextClick: (element, step, options) => {
          // Handle demo state transitions
          if (step.element === '.login-section') {
            // Transition to logged in state before moving to next step
            window.dispatchEvent(new CustomEvent('tour-demo-login'))

            // Wait for demo state to update before continuing
            setTimeout(() => {
              tourInstance.value?.moveNext()
            }, 100)
            return // Prevent default next behavior
          }

          if (step.element === '.connection-mode-setting') {
            // Switch to MainContent demo mode after connection mode step
            window.dispatchEvent(new CustomEvent('tour-switch-to-main-demo'))

            // Wait for demo components to load before continuing
            setTimeout(() => {
              tourInstance.value?.moveNext()
            }, 300)
            return // Prevent default next behavior
          }

          if (step.element === '.navigation-bar') {
            // Switch to recorded mode for next step
            window.dispatchEvent(new CustomEvent('tour-switch-to-recorded'))

            // Wait for mode switch before continuing
            setTimeout(() => {
              tourInstance.value?.moveNext()
            }, 200)
            return // Prevent default next behavior
          }

          if (step.element === '.controls-section') {
            // Trigger demo search to show course list
            window.dispatchEvent(new CustomEvent('tour-demo-search'))

            // Wait for course list to appear before continuing
            setTimeout(() => {
              tourInstance.value?.moveNext()
            }, 1200) // Longer wait for loading animation
            return // Prevent default next behavior
          }

          if (step.element === '#tour-course-list') {
            // Switch to SessionPage demo mode after course list step
            window.dispatchEvent(new CustomEvent('tour-switch-to-session-demo'))

            // Wait for session page to load before continuing
            setTimeout(() => {
              tourInstance.value?.moveNext()
            }, 1000)
            return // Prevent default next behavior
          }

          if (step.element === '#tour-batch-actions') {
            // Switch to RightPanel demo mode after batch actions step
            window.dispatchEvent(new CustomEvent('tour-switch-to-right-panel-demo'))

            // Wait for right panel demo to load before continuing
            setTimeout(() => {
              tourInstance.value?.moveNext()
            }, 300)
            return // Prevent default next behavior
          }

          if (step.element === '.right-panel[data-tab="task"]') {
            // Switch to download mode for next step
            window.dispatchEvent(new CustomEvent('tour-switch-to-download-mode'))

            // Wait for mode switch before continuing
            setTimeout(() => {
              tourInstance.value?.moveNext()
            }, 200)
            return // Prevent default next behavior
          }

          if (step.element === '.right-panel[data-tab="download"]') {
            // Switch to PlaybackPage demo mode after download panel step
            window.dispatchEvent(new CustomEvent('tour-switch-to-playback-demo'))

            // Wait for playback page to load before continuing
            setTimeout(() => {
              tourInstance.value?.moveNext()
            }, 1000)
            return // Prevent default next behavior
          }

          if (step.element === '.content') {
            // Focus on slide gallery for next step - no action needed, just continue
            setTimeout(() => {
              tourInstance.value?.moveNext()
            }, 200)
            return // Prevent default next behavior
          }

          // Continue to next step for other elements
          tourInstance.value?.moveNext()
        },
        onDestroyed: async () => {
          // Tour completed or destroyed
          isFirstVisit.value = false
          isDemoMode.value = false
          markTourAsSeen()

          // Restore original theme
          await restoreOriginalTheme()

          // Exit demo mode
          window.dispatchEvent(new CustomEvent('tour-demo-mode', { detail: { enabled: false } }))
        }
      })

      // Start the tour
      if (tourInstance.value) {
        tourInstance.value.drive()
      }
    }, 200)
  }

  const showWelcomePopup = async () => {
    if (tourInstance.value) {
      tourInstance.value.destroy()
    }

    // Save current theme and switch to light mode for welcome popup
    await saveCurrentTheme()
    await setLightMode()

    // Create welcome popup - use a modal-style approach
    tourInstance.value = driver({
      showProgress: false,
      allowClose: true,
      overlayClickNext: false,
      steps: [
        {
          popover: {
            title: t('tour.welcome.title'),
            description: t('tour.welcome.description') +
              `<div style="margin-top: 16px; display: flex; justify-content: space-between; align-items: center;">
                <button id="tour-skip" style="background: none; color: #666; border: none; padding: 8px 16px; cursor: pointer; text-decoration: underline; font-size: 14px;">${t('tour.welcome.skip')}</button>
                <button id="tour-continue" style="background: #007acc; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">${t('tour.welcome.continue')}</button>
              </div>`,
            showButtons: []
          }
        }
      ]
    })

    // Add event listeners for custom buttons
    setTimeout(() => {
      const continueBtn = document.getElementById('tour-continue')
      const skipBtn = document.getElementById('tour-skip')

      if (continueBtn) {
        continueBtn.addEventListener('click', async () => {
          tourInstance.value?.destroy()
          await startMainTour()
        })
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', async () => {
          tourInstance.value?.destroy()
          isFirstVisit.value = false
          markTourAsSeen()
          // Restore theme when skipping
          await restoreOriginalTheme()
        })
      }
    }, 100)

    tourInstance.value.drive()
  }

  const startMainTour = async () => {
    await initializeTour()
  }

  const restartTour = () => {
    showWelcomePopup()
  }

  const checkFirstVisit = () => {
    // Check if this is the first visit (you might want to use localStorage or electron-store)
    const hasSeenTour = localStorage.getItem('autoslides-tour-seen')
    if (!hasSeenTour) {
      isFirstVisit.value = true
      return true
    }
    isFirstVisit.value = false
    return false
  }

  const markTourAsSeen = () => {
    localStorage.setItem('autoslides-tour-seen', 'true')
    isFirstVisit.value = false
  }

  return {
    tourInstance,
    isFirstVisit,
    isDemoMode,
    initializeTour,
    showWelcomePopup,
    startMainTour,
    restartTour,
    checkFirstVisit,
    markTourAsSeen
  }
}