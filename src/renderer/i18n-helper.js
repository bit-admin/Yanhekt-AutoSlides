// Simple i18n helper function for updating the text of DOM elements
async function updateElementsText() {
  // Find all elements with the data-i18n attribute
  const elements = document.querySelectorAll('[data-i18n]');
  for (const element of elements) {
    const key = element.getAttribute('data-i18n');
    if (key) {
      try {
        const text = await window.i18n.t(key);
        element.textContent = text;
      } catch (error) {
        console.error(`Translation error for key ${key}:`, error);
        // Keep original text as fallback
      }
    }
  }

  // Update input elements with placeholder-i18n
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  for (const element of placeholderElements) {
    const key = element.getAttribute('data-i18n-placeholder');
    if (key) {
      try {
        const text = await window.i18n.t(key);
        element.placeholder = text;
      } catch (error) {
        console.error(`Translation error for placeholder ${key}:`, error);
      }
    }
  }

  // Update elements with title-i18n (tooltip text)
  const titleElements = document.querySelectorAll('[data-i18n-title]');
  for (const element of titleElements) {
    const key = element.getAttribute('data-i18n-title');
    if (key) {
      try {
        const text = await window.i18n.t(key);
        element.title = text;
      } catch (error) {
        console.error(`Translation error for title ${key}:`, error);
      }
    }
  }
}

// Reload text when language changes
function setupLanguageChangeHandler() {
  window.addEventListener('language-changed', () => {
    updateElementsText();
  });
}

// Initialize i18n on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  updateElementsText();
  setupLanguageChangeHandler();
});

// Export function for external use
window.i18nHelper = {
  updateText: updateElementsText
};