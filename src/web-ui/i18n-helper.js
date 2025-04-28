// Replace the current file with this more efficient implementation

// Global translations cache
let translations = {};
let currentLanguage = 'en';

// Load all translations for a language at once
async function loadTranslations(language = 'en') {
  try {
    const response = await fetch(`/api/translations/${language}`);
    
    if (!response.ok) {
      throw new Error(`Failed to load translations: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    translations = data.translations || {};
    currentLanguage = language;
    return translations;
  } catch (error) {
    console.error('Error loading translations:', error);
    return {};
  }
}

// Get translation without API call (using local cache)
function t(key, options = {}) {
  // Handle nested keys (e.g., 'web.title')
  let result = translations;
  const keyParts = key.split('.');
  
  for (const part of keyParts) {
    if (result && typeof result === 'object' && part in result) {
      result = result[part];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key; // Fallback to key itself
    }
  }
  
  if (typeof result === 'string') {
    // Process variable replacements (this is what was missing)
    let text = result;
    
    // Replace all {{varName}} with the corresponding value from options
    if (options && typeof options === 'object') {
      Object.keys(options).forEach(varName => {
        const regex = new RegExp(`{{${varName}}}`, 'g');
        text = text.replace(regex, options[varName]);
      });
    }
    
    return text;
  }
  
  console.warn(`Invalid translation for key: ${key}`);
  return key;
}

// Add a function to get current language settings
async function getCurrentLanguage() {
  try {
    const response = await fetch('/api/language');
    if (!response.ok) {
      console.error(`Language API error: ${response.status} ${response.statusText}`);
      return 'en'; // Default to English
    }
    const data = await response.json();
    currentLanguage = data.language;
    console.log('Current language setting:', currentLanguage);
    return currentLanguage;
  } catch (error) {
    console.error('Error getting language settings:', error);
    return 'en'; // Default to English
  }
}

// Change language and reload translations
async function changeLanguage(language) {
  if (language === currentLanguage) return;
  
  await loadTranslations(language);
  updateElementsText();
  
  // Notify any listeners that language changed
  window.dispatchEvent(new CustomEvent('language-changed', { detail: { language } }));
}

// Update page elements with translations from cache (no API calls)
function updateElementsText() {
  // Debugging message
  
  // Find all elements with data-i18n attribute
  const elements = document.querySelectorAll('[data-i18n]');
  
  for (const element of elements) {
    const key = element.getAttribute('data-i18n');
    if (!key) continue;
    
    try {
      // Check if the key uses the [attr]key syntax
      const attrMatch = key.match(/^\[(.*?)\](.*)/);
      
      if (attrMatch) {
        // It's an attribute translation
        const attr = attrMatch[1];
        const translationKey = attrMatch[2];
        const text = t(translationKey);
        element.setAttribute(attr, text);
      } else {
        // It's a regular text content translation
        const text = t(key);
        element.textContent = text;
        
        // Special handling for title element
        if (element.tagName.toLowerCase() === 'title') {
          document.title = text;
        }
      }
    } catch (error) {
      console.error(`Translation error for key ${key}:`, error);
    }
  }

  // Update input elements with placeholder-i18n
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (!key) return;
    element.placeholder = t(key);
  });

  // Update elements with title-i18n (tooltip text)
  document.querySelectorAll('[data-i18n-title]').forEach(element => {
    const key = element.getAttribute('data-i18n-title');
    if (!key) return;
    element.title = t(key);
  });
}

// Initialize i18n on DOMContentLoaded
document.addEventListener('DOMContentLoaded', async () => {
  // Load language setting first
  const language = await getCurrentLanguage();
  
  // Then load all translations for that language
  await loadTranslations(language);
  
  // Update all page elements
  updateElementsText();
  
  // Set up event listener for language changes
  window.addEventListener('language-changed', () => {
    updateElementsText();
  });
});

// Export functions for external use
window.i18n = {
  t,
  getCurrentLanguage,
  changeLanguage,
  updateText: updateElementsText
};