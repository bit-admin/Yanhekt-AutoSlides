import { ref } from 'vue'
import { driver } from 'driver.js'
import type { Driver } from 'driver.js'
import { useI18n } from 'vue-i18n'

// Import Driver.js CSS
import 'driver.js/dist/driver.css'

const tourInstance = ref<Driver | null>(null)
const isFirstVisit = ref(true)

export function useTour() {
  const { t } = useI18n()

  const initializeTour = () => {
    if (tourInstance.value) {
      tourInstance.value.destroy()
    }

    tourInstance.value = driver({
      showProgress: true,
      steps: [
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
      onDestroyed: () => {
        // Tour completed or destroyed
        isFirstVisit.value = false
        markTourAsSeen()
      }
    })
  }

  const showWelcomePopup = () => {
    if (tourInstance.value) {
      tourInstance.value.destroy()
    }

    // Create welcome popup - use a modal-style approach
    tourInstance.value = driver({
      showProgress: false,
      allowClose: true,
      steps: [
        {
          popover: {
            title: t('tour.welcome.title'),
            description: t('tour.welcome.description') +
              `<div style="margin-top: 16px;">
                <button id="tour-continue" style="background: #007acc; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 8px; cursor: pointer;">${t('tour.welcome.continue')}</button>
                <button id="tour-skip" style="background: #f3f3f3; color: #333; border: 1px solid #ccc; padding: 8px 16px; border-radius: 4px; cursor: pointer;">${t('tour.welcome.skip')}</button>
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
        continueBtn.addEventListener('click', () => {
          tourInstance.value?.destroy()
          startMainTour()
        })
      }

      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          tourInstance.value?.destroy()
          isFirstVisit.value = false
          markTourAsSeen()
        })
      }
    }, 100)

    tourInstance.value.drive()
  }

  const startMainTour = () => {
    initializeTour()
    if (tourInstance.value) {
      tourInstance.value.drive()
    }
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
    initializeTour,
    showWelcomePopup,
    startMainTour,
    restartTour,
    checkFirstVisit,
    markTourAsSeen
  }
}