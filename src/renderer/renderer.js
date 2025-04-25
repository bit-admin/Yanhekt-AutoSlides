document.addEventListener('DOMContentLoaded', async () => {
  
  // Clear cache on startup
  try {
    console.log('Clearing browser cache on startup...');
    await window.electronAPI.clearBrowserCache();
    console.log('Browser cache cleared on startup');
  } catch (error) {
    console.error('Error clearing browser cache on startup:', error);
  }

  const webview = document.getElementById('slideWebview');
  const btnStartCapture = document.getElementById('btnStartCapture');
  const btnStopCapture = document.getElementById('btnStopCapture');
  const btnLoadUrl = document.getElementById('btnLoadUrl');
  const btnSelectDir = document.getElementById('btnSelectDir');
  const btnDefaultConfig = document.getElementById('btnDefaultConfig');
  const inputUrl = document.getElementById('inputUrl');
  const inputOutputDir = document.getElementById('inputOutputDir');
  const inputCheckInterval = document.getElementById('inputCheckInterval');
  const statusText = document.getElementById('statusText');
  const slideCount = document.getElementById('slideCount');
  const topCropGuide = document.getElementById('topCropGuide');
  const bottomCropGuide = document.getElementById('bottomCropGuide');
  const cropGuides = document.querySelector('.crop-guides');
  const cropInfoOverlay = document.getElementById('cropInfoOverlay');
  const cacheInfo = document.getElementById('cacheInfo');
  const btnClearCache = document.getElementById('btnClearCache');
  const siteProfileSelect = document.getElementById('siteProfileSelect');
  const toggleAdvancedSettings = document.getElementById('toggleAdvancedSettings');
  const advancedSettingsContent = document.getElementById('advancedSettingsContent');
  const automationSection = document.getElementById('automationSection');
  const toggleAutomation = document.getElementById('toggleAutomation');
  const automationContent = document.getElementById('automationContent');
  const autoDetectEnd = document.getElementById('autoDetectEnd');
  const autoStartPlayback = document.getElementById('autoStartPlayback');
  const autoAdjustSpeed = document.getElementById('autoAdjustSpeed');
  const playbackSpeed = document.getElementById('playbackSpeed');
  const autoDetectTitle = document.getElementById('autoDetectTitle');
  const titleDisplay = document.getElementById('titleDisplay'); 
  const comparisonMethod = document.getElementById('comparisonMethod'); 
  const enableDoubleVerificationCheckbox = document.getElementById('enableDoubleVerification'); 
  const btnHome = document.getElementById('btnHome');
  const autoRetryError = document.getElementById('autoRetryError');

  let captureInterval = null;
  let lastImageData = null;
  let capturedCount = 0;
  let cropGuideTimer = null;
  let cacheCleanupTimer = null;
  let siteProfiles = {};
  let activeProfileId = 'default';
  let autoStartCheckInterval = null; 
  let speedAdjusted = false;
  let speedAdjustInterval = null;
  let speedAdjustRetryAttempts = 0;
  const MAX_SPEED_ADJUST_ATTEMPTS = 5;
  let currentTitleText = ''; // Track the current title for saving
  let enableDoubleVerification = false; 
  let verificationState = 'none'; 
  let potentialNewImageData = null; 
  let verificationCount = 2; // Default number of verifications
  let currentVerification = 0; // Current verification attempt
  let resetVideoProgress = true;
  let fastModeEnabled = false; 
  let autoMuteEnabled = false;
  const autoMuteCheckbox = document.getElementById('autoMuteCheckbox');
  let errorRetryAttempts = 0;
  let errorCheckInterval = null;
  let videoElementNotFoundCounter = 0;
  const MAX_VIDEO_NOT_FOUND_ERRORS = 5; // Threshold to trigger reload
  let topCropPercent = 0;
  let bottomCropPercent = 0;
  let gaussianBlurSigma = null;
  let pixelDiffThreshold = 30;
  let changeRatioThreshold = 0.005;
  let hammingThresholdLow = 0;
  let hammingThresholdUp = 5;
  let ssimThreshold = 0.999;

  // Default rules
  const DEFAULT_RULES = `yanhekt.cn###root > div.app > div.sidebar-open:first-child
yanhekt.cn###root > div.app > div.BlankLayout_layout__kC9f3:last-child > div.ant-spin-nested-loading:nth-child(2) > div.ant-spin-container > div.index_liveWrapper__YGcpO > div.index_userlist__T-6xf:last-child > div.index_staticContainer__z3yt-
yanhekt.cn###ai-bit-shortcut
yanhekt.cn##div#ai-bit-animation-modal`;

  // Add this call after loading the blocking rules
  await loadConfig();
  await loadBlockingRules();

  window.electronAPI.onThemeChange((event, data) => {
    if (data.darkMode === 'dark' || 
        (data.darkMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  });

  /**
   * Updates the status text and applies translation
   * @param {string} key - The translation key name, automatically prefixed with renderer.statusText.
   * @param {Object} replacements - Replacement variables for dynamic text
   * @param {number} timeout - Optional timeout duration, after which it reverts to the default state
   * @returns {Promise<void>}
   */
  async function updateStatus(key, replacements = {}, timeout = 0) {
    try {
      // Build complete translation key names
      const fullKey = `renderer.statusText.${key}`;
      const text = await window.i18n.t(fullKey, replacements);
      statusText.textContent = text;
      
      // If a timeout is set, it will revert to the default state after the specified time.
      if (timeout > 0) {
        setTimeout(async () => {
          const defaultKey = captureInterval ? 'capturing' : 'idle';
          await updateStatus(defaultKey);
        }, timeout);
      }
    } catch (error) {
      console.error(`Translation error for status key ${key}:`, error);
      // If the translation is incorrect, use the key name as a fallback
      statusText.textContent = key;
    }
  }
  
  /**
   * Update status text based on condition
   * @param {boolean} condition - Conditional expression
   * @param {string} trueKey - Translation key name used when condition is true
   * @param {string} falseKey - Translation key name used when condition is false
   * @param {Object} replacements - Replacement variables
   * @returns {Promise<void>}
   */
  async function updateStatusConditional(condition, trueKey, falseKey, replacements = {}) {
    await updateStatus(condition ? trueKey : falseKey, replacements);
  }

  /**
   * Update element text and apply translation
   * @param {HTMLElement} element - The DOM element to be updated
   * @param {string} key - Translation key name (without namespace)
   * @param {string} namespace - Translation namespace
   * @param {Object} replacements - Replacement variables
   * @returns {Promise<void>}
   */
  async function updateElementTranslation(element, key, namespace, replacements = {}) {
    if (!element) return;
    
    try {
      const fullKey = `renderer.${namespace}.${key}`;
      const text = await window.i18n.t(fullKey, replacements);
      element.textContent = text;
    } catch (error) {
      console.error(`Translation error for ${namespace}.${key}:`, error);
      // Use simple fallback handling
      switch (key) {
        case 'calculating':
          element.textContent = 'Calculating cache size...';
          break;
        case 'totalSize':
          element.textContent = `Total cache: ${replacements.size || 0} MB`;
          break;
        case 'clearing':
          element.textContent = 'Clearing browser cache...';
          break;
        case 'error':
          element.textContent = 'Error calculating cache size';
          break;
        case 'cropInfo':
          element.textContent = `Crop: Top ${replacements.top || 0}%, Bottom ${replacements.bottom || 0}%`;
          break;
        case 'count':
          element.textContent = `Slides captured: ${replacements.count || 0}`;
          break;
        default:
          // If there was original content, keep the original content.
          if (!element.textContent) {
            element.textContent = key;
          }
      }
    }
  }

  /**
   * Update cache information display
   * @param {string} key - Translation key name: 'calculating', 'totalSize', 'clearing', 'error'
   * @param {Object} replacements - Replacement variables, e.g., {size: 123.45}
   * @returns {Promise<void>}
   */
  async function updateCacheInfoText(key, replacements = {}) {
    await updateElementTranslation(cacheInfo, key, 'cache', replacements);
  }
  
  /**
   * Update the slide count display
   * @param {number} count - The number of slides
   * @returns {Promise<void>}
   */
  async function updateSlideCountText(count) {
    await updateElementTranslation(slideCount, 'count', 'ui', { count });
  }

  /**
   * Updates the text of tasks and status indicators
   * @param {string} indicatorType - Indicator type: 'fastMode', 'taskProgress', 'fastModeSkipped'
   * @param {HTMLElement} element - The DOM element to be updated
   * @param {Object} replacements - Replacement variables
   * @returns {Promise<void>}
   */
  async function updateIndicatorText(indicatorType, element, replacements = {}) {
    if (!element) return;
    
    try {
      const fullKey = `renderer.indicators.${indicatorType}`;
      const text = await window.i18n.t(fullKey, replacements);
      element.textContent = text;
    } catch (error) {
      console.error(`Translation error for indicator ${indicatorType}:`, error);
      
      switch (indicatorType) {
        case 'fastMode':
          element.textContent = '⚡ FAST MODE ACTIVE ⚡';
          break;
        case 'taskProgress':
          const current = replacements.current || '?';
          const total = replacements.total || '?';
          element.textContent = `Processing task ${current}/${total}`;
          break;
        case 'fastModeSkipped':
          element.textContent = 'Note: Fast Mode skipped for live stream (only applicable to sessions)';
          break;
        case 'muteAudio':
          element.textContent = '🔇 AUDIO MUTED 🔇';
          break;
        default:
          break;
      }
    }
  }
  
  // Load default URL when app starts
  setTimeout(async () => {
    // Replace direct URL loading with custom homepage
    if (webview.src === 'about:blank' || !webview.src) {
      // Check current language
      let currentLanguage = 'en'; // Default to English
      try {
        currentLanguage = await window.i18n.getCurrentLanguage();
      } catch (error) {
        console.error('Error getting current language:', error);
        // Continue with default language if there's an error
      }
      
      // Choose homepage based on language
      const homepageFile = currentLanguage === 'zh' ? 'cn-homepage.html' : 'homepage.html';
      const homepageUrl = `file://${window.location.pathname.replace('index.html', homepageFile)}`;
      console.log(`Loading ${currentLanguage} homepage from:`, homepageUrl);
      
      webview.src = homepageUrl;
      inputUrl.value = '';
    }
  }, 200);

  // Create loading overlay with message
  const loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'loadingOverlay';
  loadingOverlay.innerHTML = '<div class="spinner"></div><span class="loading-text">Loading content...</span>';
  loadingOverlay.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.7);
    z-index: 9999;
    display: none;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    text-align: center;
    color: #333;
  `;
  
  // Create styles for the spinner and text
  const loadingStyles = document.createElement('style');
  loadingStyles.textContent = `
    #loadingOverlay .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top-color: #3b82f6;
      animation: spin 1s ease-in-out infinite;
      margin-bottom: 20px;
    }
    
    #loadingOverlay .loading-text {
      font-size: 18px;
      font-weight: 500;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    /* Timeout state - darkened background */
    #loadingOverlay.timeout {
      background: rgba(0, 0, 0, 1);
      color: white;
    }
    
    #loadingOverlay.timeout .spinner {
      display: none;
    }
    
    #loadingOverlay.timeout .loading-text {
      font-size: 20px;
      max-width: 80%;
      line-height: 1.5;
    }
    
    #loadingOverlay.timeout .loading-text:before {
      content: '\\26A0';  /* Warning symbol */
      font-size: 36px;
      color: #f39c12;
      display: block;
      margin-bottom: 20px;
    }
  `;
  document.head.appendChild(loadingStyles);
  
  // Directly append to webview container instead of document.body
  const webviewContainer = document.querySelector('.webview-container');
  if (webviewContainer) {
    webviewContainer.appendChild(loadingOverlay);
  }
  
  // Add a timeout function to update the message if loading takes too long
  let loadingMessageTimeoutId = null;
  
  function updateLoadingMessage() {
    if (loadingOverlay) {
      console.log('Loading timeout occurred - showing timeout message');
      loadingOverlay.classList.add('timeout');
      const loadingText = loadingOverlay.querySelector('.loading-text');
      if (loadingText) {
        loadingText.innerHTML = `
          This page is taking longer than expected to load<br><br>
          It might be temporarily unavailable or too busy.<br>
          Check your network connection if the issue persists.
        `;
      }
    }
  }

  // Add flag to track if user is actively editing the URL
  let userIsEditingUrl = false;

  // Add event listeners to detect when user is interacting with URL input
  inputUrl.addEventListener('focus', () => {
    userIsEditingUrl = true;
  });

  inputUrl.addEventListener('blur', () => {
    userIsEditingUrl = false;
  });

  // Function definitions
  function loadURL() {
    const url = inputUrl.value;
    if (url) {
      const loaded = safeLoadURL(url);
    }
  }

  function safeLoadURL(url) {
    if (url && typeof url === 'string' && url.trim() !== '') {
      try {
        // Automatically add https:// if protocol is missing
        if (!url.match(/^[a-zA-Z]+:\/\//)) {
          url = 'https://' + url;
          console.log('Protocol missing, using:', url);
          // Update input field with the corrected URL
          inputUrl.value = url;
        }
        
        // Basic URL validation
        new URL(url); // This will throw if URL is invalid
        
        console.log('Loading URL:', url);
        // Use src for consistency instead of mixing src and loadURL
        webview.src = url;
        return true;
      } catch (error) {
        console.error('Invalid URL:', url, error);
        statusText.textContent = 'Invalid URL format';
        return false;
      }
    } else {
      console.warn('Attempted to load empty URL');
      return false;
    }
  }
  
  async function loadConfig() {
    try {
      const config = await window.electronAPI.getConfig();
      inputOutputDir.value = config.outputDir || '';
      inputCheckInterval.value = config.checkInterval || 2;
      gaussianBlurSigma = config.captureStrategy.gaussianBlurSigma || 0.5;
      pixelDiffThreshold = config.captureStrategy.pixelDiffThreshold || 30;
      changeRatioThreshold = config.captureStrategy.changeRatioThreshold || 0.005;
      hammingThresholdLow = config.captureStrategy.hammingThresholdLow || 0;
      hammingThresholdUp = config.captureStrategy.hammingThresholdUp || 5;
      ssimThreshold = config.captureStrategy.ssimThreshold || 0.999;
      
      
      // Load site profiles with default built-in profiles
      siteProfiles = config.siteProfiles || {
        yanhekt_session: {
          name: 'YanHeKT Session',
          elementSelector: '#video_id_topPlayer_html5_api',
          urlPattern: 'www.yanhekt.cn/session',
          builtin: true,
          automation: {
            autoDetectEnd: true,
            endDetectionSelector: '.player-ended-poster',
            autoStartPlayback: true,
            playButtonSelector: '.player-mid-button-container button',
            countdownSelector: '', // Leave empty for session player
            autoAdjustSpeed: false,  // Enable auto speed adjustment
            speedSelector: '#video_id_mainPlayer_html5_api', // not same as elementSelector
            playbackSpeed: '3.0', // Default to 3x speed
            autoDetectTitle: true, // Add title detection
            courseTitleSelector: '.ant-breadcrumb li:nth-child(2) a', // Course title selector
            sessionInfoSelector: '.ant-breadcrumb li:nth-child(3) span', // Session info selector
            autoRetryError: true,
            errorSelector: '.vjs-errors-dialog',
            maxRetryAttempts: '30'
          }
        },
        yanhekt_live: {
          name: 'YanHeKT Live',
          elementSelector: '#video_id_mainPlayer_html5_api',
          urlPattern: 'www.yanhekt.cn/live',
          builtin: false,
          automation: {
            autoDetectEnd: true,
            endDetectionSelector: '.VideoResult_result__LdbB3',
            autoStartPlayback: true,
            playButtonSelector: '.player-mid-button-container button',
            countdownSelector: '.countdown-content',
            autoAdjustSpeed: false,
            speedSelector: '#video_id_mainPlayer_html5_api', // Same as elementSelector
            playbackSpeed: '1.0',  // Default to 1x speed
            autoDetectTitle: true, // Enable title detection
            courseTitleSelector: '.index_liveHeader__uN3uM', // Course title selector
            sessionInfoSelector: '', // No session info for live
            autoRetryError: true,
            errorSelector: '.vjs-errors-dialog',
            maxRetryAttempts: '3'
          }
        }
      };

      applyDarkMode(config);
      
      // Set default active profile to Live Player
      activeProfileId = config.activeProfileId || 'yanhekt_live';
      
      // Populate profile dropdown
      updateProfileDropdown();
      
      // Select active profile
      siteProfileSelect.value = activeProfileId;
      loadProfileDetails(activeProfileId);
      
      // Load comparison method setting
      if (config.comparisonMethod) {
        comparisonMethod.value = config.comparisonMethod;
      }

      // Load double verification setting
      enableDoubleVerification = config.enableDoubleVerification || true;
      enableDoubleVerificationCheckbox.checked = enableDoubleVerification;

      // Load verification count
      verificationCount = config.verificationCount || 2;

      // Load Fast Mode setting
      if (config.fastModeEnabled !== undefined) {
        fastModeEnabled = config.fastModeEnabled;
      }

      // Load Reset Video Progress setting
      if (config.resetVideoProgress !== undefined) {
        resetVideoProgress = config.resetVideoProgress;
      }

      if (config.autoMuteEnabled !== undefined) {
        autoMuteEnabled = config.autoMuteEnabled;
      }
      
      return config;
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }

  function applyDarkMode(config) {
    const darkMode = config.darkMode || 'system';
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (darkMode === 'dark' || (darkMode === 'system' && systemPrefersDark)) {
        document.documentElement.classList.add('dark-mode');
    } else {
        document.documentElement.classList.remove('dark-mode');
    }
}
  
  async function saveConfig() {
    try {
      const config = {
        outputDir: inputOutputDir.value,
        checkInterval: parseFloat(inputCheckInterval.value),
        siteProfiles: siteProfiles,
        activeProfileId: activeProfileId,
        comparisonMethod: comparisonMethod.value, 
        enableDoubleVerification: enableDoubleVerificationCheckbox.checked,
        fastModeEnabled: fastModeEnabled,
        resetVideoProgress: resetVideoProgress,
        autoMuteEnabled: autoMuteEnabled
      };
      
      await window.electronAPI.saveConfig(config);
      updateStatus('settingsSaved', {}, 3000);
      
    } catch (error) {
      console.error('Failed to save config:', error);
      statusText.textContent = 'Error saving settings';
    }
  }

  async function resetConfigToDefaults() {
    try {
      // Default values from schema in main.js
      const defaultConfig = {
        outputDir: await window.electronAPI.getConfig().then(config => config.outputDir), // Keep output dir as is
        checkInterval: 2,
        comparisonMethod: 'default',
        enableDoubleVerification: true
      };
      
      // Update input fields
      inputCheckInterval.value = defaultConfig.checkInterval;
      comparisonMethod.value = defaultConfig.comparisonMethod;
      enableDoubleVerificationCheckbox.checked = defaultConfig.enableDoubleVerification;
      
      // Save to config directly
      await window.electronAPI.saveConfig(defaultConfig);
      updateStatus('settingsReset', {}, 3000);
      
    } catch (error) {
      console.error('Failed to reset settings:', error);
      statusText.textContent = 'Error resetting settings';
    }
  }

  // Add profile management functions
  function updateProfileDropdown() {
    // Clear existing options except defaults
    const options = Array.from(siteProfileSelect.options);
    for (const option of options) {
      if (!['default', 'custom'].includes(option.value)) {
        siteProfileSelect.removeChild(option);
      }
    }
    
    // Add profiles from config
    for (const [id, profile] of Object.entries(siteProfiles)) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = profile.name;
      
      // Insert before the "Custom..." option
      const customOption = Array.from(siteProfileSelect.options).find(o => o.value === 'custom');
      siteProfileSelect.insertBefore(option, customOption);
    }
  }

  function loadProfileDetails(profileId) {
    if (profileId === 'default') {
      // Hide automation section for default profile
      automationSection.classList.add('hidden');
      currentProfile = null;
      return;
    }
    
    automationSection.classList.remove('hidden');
    
    // Custom profile creation is no longer supported in the main interface
    if (profileId === 'custom') {
      automationSection.classList.add('hidden');
      currentProfile = null;
      return;
    }
    
    // Load existing profile
    const profile = siteProfiles[profileId];
    if (profile) {
      if (profile.automation) {
        // Only set checkbox states, don't populate input fields
        autoDetectEnd.checked = profile.automation.autoDetectEnd || false;
        autoStartPlayback.checked = profile.automation.autoStartPlayback || false;
        autoAdjustSpeed.checked = profile.automation.autoAdjustSpeed || false;
        autoDetectTitle.checked = profile.automation.autoDetectTitle || false;
        autoRetryError.checked = profile.automation.autoRetryError || false;
      } else {
        autoDetectEnd.checked = false;
        autoStartPlayback.checked = false;
        autoAdjustSpeed.checked = false;
        autoDetectTitle.checked = false;
        autoRetryError.checked = false;
      }
      
      currentProfile = profile;
    }
  }

  async function updateCacheInfo() {
    try {
      updateCacheInfoText('calculating');
      const cacheData = await window.electronAPI.getCacheSize();
      updateCacheInfoText('totalSize', { size: cacheData.totalMB });
      
      // Add detailed tooltip
      const details = cacheData.details;
      const detailsText = [
        `Browser cache: ${details.cache} MB`,
        `GPU cache: ${details.gpuCache} MB`,
        `Local storage: ${details.localStorage} MB`,
        `Session storage: ${details.sessionStorage} MB`
      ].join('\n');
      
      cacheInfo.title = detailsText;
    } catch (error) {
      console.error('Error updating cache info:', error);
      cacheInfo.textContent = 'Error calculating cache size';
    }
  }
  
  // Clear browser cache
  async function clearBrowserCache() {
    try {
      btnClearCache.disabled = true;
      
      const result = await window.electronAPI.clearBrowserCache();
      
      if (result.success) {
        updateStatus('cacheCleard', {}, 3000);
      } else {
        statusText.textContent = 'Failed to clear cache';
      }
      
      await updateCacheInfo();
      btnClearCache.disabled = false;
    } catch (error) {
      console.error('Error clearing browser cache:', error);
      statusText.textContent = 'Error clearing cache';
      btnClearCache.disabled = false;
    }
  }

  // Set up automatic cache cleanup
  function setupCacheCleanupTimer() {
    // Clear any existing timer
    if (cacheCleanupTimer) {
      clearInterval(cacheCleanupTimer);
      cacheCleanupTimer = null;
    }
    
    // Get the interval from config
    window.electronAPI.getConfig().then(config => {
      const interval = config.cacheCleanInterval || 15;
      
      // If interval is valid and not zero, set up timer
      if (interval > 0) {
        console.log(`Setting up cache cleanup timer for every ${interval} minutes`);
        cacheCleanupTimer = setInterval(async () => {
          if (captureInterval) {  // Only clean if capturing
            console.log('Running automatic cache cleanup');
            await window.electronAPI.clearBrowserCache();
            await updateCacheInfo();
          }
        }, interval * 60 * 1000);
      }
    });
  }
  
  async function loadBlockingRules() {
    try {
      const rules = await window.electronAPI.getBlockingRules();
      console.log('Blocking rules loaded successfully');
      return rules;
    } catch (error) {
      console.error('Failed to load blocking rules:', error);
      return DEFAULT_RULES; // Fall back to default rules on error
    }
  }

  // Function to update the crop guide positions
  async function updateCropGuides(isAutomatic = false) {
    // Get webview dimensions
    const webviewHeight = webview.clientHeight;
    
    // Calculate guide positions based on crop percentages
    const config = await window.electronAPI.getConfig();
    const topCropPercent = config.topCropPercent || 0;
    const bottomCropPercent = config.bottomCropPercent || 0;
    
    // Calculate pixel positions
    const topPosition = Math.floor(webviewHeight * (topCropPercent / 100));
    const bottomPosition = Math.floor(webviewHeight * (1 - bottomCropPercent / 100));
    
    // Update guide positions
    topCropGuide.style.top = `${topPosition}px`;
    bottomCropGuide.style.top = `${bottomPosition}px`;
    
    // Update info overlay with current crop percentages
    cropInfoOverlay.textContent = `Crop: Top ${topCropPercent}%, Bottom ${bottomCropPercent}%`;
    
    // Show the guides
    cropGuides.classList.add('visible');
    
    // Clear any existing timer
    if (cropGuideTimer) {
      clearTimeout(cropGuideTimer);
    }
    
    cropGuideTimer = setTimeout(() => {
      cropGuides.classList.remove('visible');
    }, 3000);
  }
  
  function applyBlockingRules(rulesText) {
    // Get rules either from parameter or by fetching from config
    const getRulesPromise = rulesText ? 
      Promise.resolve(rulesText) : 
      window.electronAPI.getBlockingRules();
    
    getRulesPromise.then(rules => {
      // Ensure rules is a string and split into lines
      const ruleLines = typeof rules === 'string' ? rules.trim().split('\n') : rules;
  
      if (!webview.src || webview.src === 'about:blank') {
        return;
      }
      
      try {
        const currentUrl = new URL(webview.src);
        const currentDomain = currentUrl.hostname;
        
        let cssToInject = '';
        let appliedRules = 0;
        
        // Process each rule line
        for (let i = 0; i < ruleLines.length; i++) {
          const rule = ruleLines[i];
          if (!rule || rule.startsWith('#')) continue; // Skip empty lines or comments
          
          const parts = rule.split('##');
          if (parts.length !== 2) continue; // Skip invalid rules
          
          const ruleDomain = parts[0];
          const selector = parts[1];
          
          // Check if rule applies to current domain
          if (currentDomain.endsWith(ruleDomain) || 
              currentDomain === `www.${ruleDomain}` ||
              ruleDomain === '*') {
            cssToInject += `${selector} { display: none !important; }\n`;
            appliedRules++;
          }
        }
      
        if (cssToInject) {
          // Inject both CSS and JavaScript to ensure elements are hidden
          const script = `
            (function() {
              // 1. Add CSS style
              const style = document.createElement('style');
              style.id = 'autoslides-blocking-css';
              style.textContent = ${JSON.stringify(cssToInject)};
              
              // Remove any existing style we added before
              const existingStyle = document.getElementById('autoslides-blocking-css');
              if (existingStyle) {
                existingStyle.remove();
              }
              
              document.head.appendChild(style);
              
              // 2. Also use JavaScript to directly hide elements for more aggressive hiding
              function hideElements() {
                const selectors = [${ruleLines
                  .filter(rule => rule && !rule.startsWith('#'))
                  .map(rule => {
                    const parts = rule.split('##');
                    if (parts.length !== 2) return null;
                    
                    const ruleDomain = parts[0];
                    const selector = parts[1];
                    
                    // Only include selectors for matching domains
                    if (currentDomain.endsWith(ruleDomain) || 
                        currentDomain === "www.${ruleDomain}" ||
                        ruleDomain === '*') {
                      return JSON.stringify(selector);
                    }
                    return null;
                  })
                  .filter(Boolean)
                  .join(', ')}];
                  
                selectors.forEach(selector => {
                  try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(el => {
                      el.style.display = 'none';
                    });
                  } catch (e) {
                    console.error('Error hiding element with selector: ' + selector, e);
                  }
                });
              }
              
              // Run now
              hideElements();
              
              // Also run again after a short delay to catch elements that might load later
              setTimeout(hideElements, 1000);
              
              console.log('AutoSlides: Applied element blocking rules');
            })();
          `;
          
          webview.executeJavaScript(script)
            .then(() => {
              updateStatus('rulesApplied', { count: appliedRules }, 3000);
            })
            .catch(err => {
              console.error('Error applying blocking rules:', err);
              statusText.textContent = 'Error applying rules';
            });
        } else {
          setTimeout(() => {
            updateStatusConditional(captureInterval, 'capturing', 'idle');
          }, 3000);
        }
      } catch (error) {
        console.error('Error in applyBlockingRules:', error);
        statusText.textContent = 'Error processing rules';
      }
    });
  }
  
  async function selectOutputDirectory() {
    try {
      const directory = await window.electronAPI.selectOutputDirectory();
      inputOutputDir.value = directory;
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  }
  
  // Capture screenshot from webview
  async function captureScreenshot() {
    return new Promise((resolve, reject) => {
      try {
        // Check if we should use element capture
        const currentUrl = webview.src;
        let profileToUse = null;
        
        // First check if we have an active non-default profile
        if (activeProfileId !== 'default' && siteProfiles[activeProfileId]) {
          profileToUse = siteProfiles[activeProfileId];
        } else {
          // Otherwise try to match by URL pattern
          for (const [id, profile] of Object.entries(siteProfiles)) {
            if (profile.urlPattern && currentUrl.includes(profile.urlPattern)) {
              profileToUse = profile;
              break;
            }
          }
        }

        // Special handling for yanhekt video player
        if (profileToUse && 
            profileToUse.elementSelector && 
            profileToUse.elementSelector.includes('video') &&
            currentUrl.includes('yanhekt.cn')) {
        
            captureVideoElement(profileToUse.elementSelector)
            .then(resolve)
            .catch(error => {
              console.error('Video capture error:', error);
              // Track "Video element not found" errors specifically
              if (error.message === 'Video element not found') {
                videoElementNotFoundCounter++;
                console.log(`Video element not found count: ${videoElementNotFoundCounter}/${MAX_VIDEO_NOT_FOUND_ERRORS}`);
              }
              // Fall back to regular screenshot
              webview.capturePage().then(image => {
                resolve(image.toDataURL());
              });
            });
        }
        
        // Regular element capture for other elements
        else if (profileToUse && profileToUse.elementSelector) {
          // Use element-specific capture
          webview.executeJavaScript(`
            (function() {
              try {
                const element = document.querySelector('${profileToUse.elementSelector}');
                if (!element) {
                  return { error: 'Element not found', selector: '${profileToUse.elementSelector}' };
                }
                
                // Get element position and dimensions
                const rect = element.getBoundingClientRect();
                
                // Create canvas at the proper size
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = rect.width;
                canvas.height = rect.height;
                
                // Draw just the element onto the canvas
                context.drawImage(element, 0, 0, rect.width, rect.height);
                
                // Return the data URL
                return {
                  dataUrl: canvas.toDataURL('image/png'),
                  width: rect.width,
                  height: rect.height
                };
              } catch (err) {
                return { error: err.toString() };
              }
            })();
          `)
          .then(result => {
            if (result.error) {
              console.error('Element capture error:', result.error);
              // Fall back to regular screenshot
              webview.capturePage().then(image => {
                resolve(image.toDataURL());
              });
            } else {
              resolve(result.dataUrl);
            }
          })
          .catch(error => {
            console.error('Error executing element capture script:', error);
            // Fall back to regular screenshot
            webview.capturePage().then(image => {
              resolve(image.toDataURL());
            });
          });
        } else {
          // Use regular full page screenshot
          webview.capturePage().then(image => {
            resolve(image.toDataURL());
          });
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  // Add this function to handle video element capture specially
  async function captureVideoElement(selector) {
    return new Promise((resolve, reject) => {
      webview.executeJavaScript(`
        (function() {
          try {
            const video = document.querySelector('${selector}');
            if (!video) {
              return { error: 'Video element not found' };
            }
            
            // Create a canvas with the video dimensions
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Draw the current video frame
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Return the data URL
            return { dataUrl: canvas.toDataURL('image/png') };
          } catch (err) {
            return { error: err.toString() };
          }
        })();
      `)
      .then(result => {
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result.dataUrl);
        }
      })
      .catch(reject);
    });
  }

  // Add this function to detect and switch profiles based on URL
  function checkAndSwitchProfile(url) {
    // Don't switch if capturing is in progress
    if (captureInterval) {
      return;
    }
    
    // Try to find a matching profile
    for (const [id, profile] of Object.entries(siteProfiles)) {
      if (profile.urlPattern) {
        // Split the URL patterns by space and check each one
        const patterns = profile.urlPattern.split(' ');
        for (const pattern of patterns) {
          if (pattern && url.includes(pattern)) {
            // Switch to this profile
            siteProfileSelect.value = id;
            activeProfileId = id;
            loadProfileDetails(id);
            updateStatus('switchProfile', { profile: profile.name }, 3000);
            return;
          }
        }
      }
    }
  }

  // Crop image based on current settings
  function cropImage(imageData) {
    return new Promise(async (resolve) => {
      
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const topCrop = Math.floor(img.height * (topCropPercent / 100));
        const bottomCrop = Math.floor(img.height * (1 - bottomCropPercent / 100));
        
        // Set canvas size to the cropped dimensions
        canvas.width = img.width;
        canvas.height = bottomCrop - topCrop;
        
        // Draw the cropped portion of the image
        ctx.drawImage(
          img, 
          0, topCrop,                 // Source x, y
          img.width, bottomCrop - topCrop, // Source width, height
          0, 0,                       // Destination x, y
          canvas.width, canvas.height // Destination width, height
        );
        
        // Get the cropped image as data URL
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = () => {
        console.error('Error loading image for cropping');
        resolve(imageData); // Return original if there's an error
      };
      
      img.src = imageData;
    });
  }

  // Convert ImageData to grayscale
  function convertToGrayscale(imageData) {
    const data = imageData.data;
    const newImageData = new ImageData(
      new Uint8ClampedArray(imageData.data), 
      imageData.width, 
      imageData.height
    );
    const newData = newImageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
      // Using luminance formula: Y = 0.299R + 0.587G + 0.114B
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      newData[i] = gray;     // R
      newData[i + 1] = gray; // G
      newData[i + 2] = gray; // B
      // Alpha channel remains unchanged
    }
    
    return newImageData;
  }

  // Apply Gaussian blur to ImageData
  function applyGaussianBlur(imageData, sigma = null) {
    const effectiveSigma = sigma !== null ? sigma : (gaussianBlurSigma || 0.5);

    const width = imageData.width;
    const height = imageData.height;
    const src = imageData.data;
    const dst = new Uint8ClampedArray(src);
    
    // Generate Gaussian kernel
    const radius = Math.ceil(3 * effectiveSigma);
    const kernelSize = 2 * radius + 1;
    const kernel = new Array(kernelSize);
    
    let sum = 0;
    for (let i = 0; i < kernelSize; i++) {
      const x = i - radius;
      kernel[i] = Math.exp(-(x * x) / (2 * effectiveSigma * effectiveSigma));
      sum += kernel[i];
    }
    
    // Normalize kernel
    for (let i = 0; i < kernelSize; i++) {
      kernel[i] /= sum;
    }
    
    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let val = 0;
        
        for (let i = -radius; i <= radius; i++) {
          const kx = Math.min(Math.max(0, x + i), width - 1);
          const idx = (y * width + kx) * 4;
          const weight = kernel[i + radius];
          
          val += src[idx] * weight; // Only need one channel for grayscale
        }
        
        const idx = (y * width + x) * 4;
        dst[idx] = val;
        dst[idx + 1] = val;
        dst[idx + 2] = val;
        // Alpha remains unchanged
      }
    }
    
    // Vertical pass
    const temp = new Uint8ClampedArray(dst);
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let val = 0;
        
        for (let i = -radius; i <= radius; i++) {
          const ky = Math.min(Math.max(0, y + i), height - 1);
          const idx = (ky * width + x) * 4;
          const weight = kernel[i + radius];
          
          val += temp[idx] * weight; // Only need one channel for grayscale
        }
        
        const idx = (y * width + x) * 4;
        dst[idx] = val;
        dst[idx + 1] = val;
        dst[idx + 2] = val;
        // Alpha remains unchanged
      }
    }
    
    return new ImageData(dst, width, height);
  }

  // Compare pixels between two ImageData objects
  function comparePixels(data1, data2) {
    let diffCount = 0;
    const threshold = pixelDiffThreshold; // Pixel difference threshold
    
    for (let i = 0; i < data1.data.length; i += 4) {
      const r1 = data1.data[i];
      const g1 = data1.data[i + 1];
      const b1 = data1.data[i + 2];
      
      const r2 = data2.data[i];
      const g2 = data2.data[i + 1];
      const b2 = data2.data[i + 2];
      
      const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
      if (diff > threshold) {
        diffCount++;
      }
    }
    
    const totalPixels = (data1.width * data1.height);
    const changeRatio = diffCount / totalPixels;
    
    return {
      diffCount,
      totalPixels,
      changeRatio
    };
  }

  // Resize image data to specific dimensions
  function resizeImageData(imageData, newWidth, newHeight) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Create a temporary image
    const img = new Image();
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // Set the temp canvas to the original image size
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    
    // Create ImageData and put it on the temp canvas
    tempCtx.putImageData(imageData, 0, 0);
    
    // Set target canvas size
    canvas.width = newWidth;
    canvas.height = newHeight;
    
    // Draw resized image to the target canvas
    ctx.drawImage(tempCanvas, 0, 0, imageData.width, imageData.height, 0, 0, newWidth, newHeight);
    
    // Return new ImageData
    return ctx.getImageData(0, 0, newWidth, newHeight);
  }

  // Calculate perceptual hash using DCT (Discrete Cosine Transform)
  function calculatePerceptualHash(imageData) {
    // Convert to grayscale if not already
    const grayscaleData = convertToGrayscale(imageData);
    
    // Resize to 32x32 for DCT processing
    const resizedData = resizeImageData(grayscaleData, 32, 32);
    
    // Convert image data to 2D array for DCT
    const pixels = new Array(32);
    for (let y = 0; y < 32; y++) {
      pixels[y] = new Array(32);
      for (let x = 0; x < 32; x++) {
        const idx = (y * 32 + x) * 4;
        pixels[y][x] = resizedData.data[idx]; // Use red channel (grayscale)
      }
    }
    
    // Apply DCT - simplified version
    const dct = applySimplifiedDCT(pixels, 32);
    
    // Calculate median of low frequency components (excluding DC component)
    // We'll use a smaller portion of the DCT coefficients (8x8 low-freq components)
    const hashSize = 8;
    const dctLowFreq = [];
    for (let y = 0; y < hashSize; y++) {
      for (let x = 0; x < hashSize; x++) {
        if (!(x === 0 && y === 0)) { // Skip DC component (top-left)
          dctLowFreq.push(dct[y][x]);
        }
      }
    }
    dctLowFreq.sort((a, b) => a - b);
    const medianValue = dctLowFreq[Math.floor(dctLowFreq.length / 2)];
    
    // Generate hash using low frequency components
    let hash = '';
    for (let y = 0; y < hashSize; y++) {
      for (let x = 0; x < hashSize; x++) {
        if (!(x === 0 && y === 0)) { // Skip DC component
          hash += (dct[y][x] >= medianValue) ? '1' : '0';
        }
      }
    }
    
    return hash;
  }

  // Apply a simplified DCT
  function applySimplifiedDCT(pixels, size) {
    const result = Array(size).fill().map(() => Array(size).fill(0));
    
    for (let u = 0; u < size; u++) {
      for (let v = 0; v < size; v++) {
        let sum = 0;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const cosX = Math.cos((2 * x + 1) * u * Math.PI / (2 * size));
            const cosY = Math.cos((2 * y + 1) * v * Math.PI / (2 * size));
            sum += pixels[y][x] * cosX * cosY;
          }
        }
        
        // Apply weight factors
        const cu = (u === 0) ? 1 / Math.sqrt(2) : 1;
        const cv = (v === 0) ? 1 / Math.sqrt(2) : 1;
        result[u][v] = sum * cu * cv * (2 / size);
      }
    }
    
    return result;
  }

  // Calculate Hamming distance between two hashes
  function calculateHammingDistance(hash1, hash2) {
    if (hash1.length !== hash2.length) {
      throw new Error('Hash lengths do not match');
    }
    
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++;
      }
    }
    
    return distance;
  }

  // Calculate SSIM (Structural Similarity Index)
  function calculateSSIM(img1Data, img2Data) {
    // Convert to grayscale
    const gray1 = convertToGrayscale(img1Data);
    const gray2 = convertToGrayscale(img2Data);
    
    // Calculate means
    let mean1 = 0, mean2 = 0;
    const pixelCount = gray1.width * gray1.height;
    
    for (let i = 0; i < gray1.data.length; i += 4) {
      mean1 += gray1.data[i];
      mean2 += gray2.data[i];
    }
    mean1 /= pixelCount;
    mean2 /= pixelCount;
    
    // Calculate variances and covariance
    let var1 = 0, var2 = 0, covar = 0;
    for (let i = 0; i < gray1.data.length; i += 4) {
      const diff1 = gray1.data[i] - mean1;
      const diff2 = gray2.data[i] - mean2;
      var1 += diff1 * diff1;
      var2 += diff2 * diff2;
      covar += diff1 * diff2;
    }
    var1 /= pixelCount;
    var2 /= pixelCount;
    covar /= pixelCount;
    
    // Constants for stability
    const C1 = 0.01 * 255 * 0.01 * 255;
    const C2 = 0.03 * 255 * 0.03 * 255;
    
    // Calculate SSIM
    const numerator = (2 * mean1 * mean2 + C1) * (2 * covar + C2);
    const denominator = (mean1 * mean1 + mean2 * mean2 + C1) * (var1 + var2 + C2);
    
    return numerator / denominator;
  }

  // Compare images for changes
  function compareImages(img1Data, img2Data) {
    return new Promise(async (resolve) => {
      
      const img1 = new Image();
      const img2 = new Image();
      let loadedCount = 0;
  
      function processImages() {
        if (loadedCount === 2) {
          const canvas1 = document.createElement('canvas');
          const canvas2 = document.createElement('canvas');
          const ctx1 = canvas1.getContext('2d');
          const ctx2 = canvas2.getContext('2d');
  
          canvas1.width = img1.width;
          canvas1.height = img1.height;
          canvas2.width = img2.width;
          canvas2.height = img2.height;
  
          // Now we use the topCropPercent and bottomCropPercent from config
          const topCrop = Math.floor(img1.height * (topCropPercent / 100));
          const bottomCrop = Math.floor(img1.height * (1 - bottomCropPercent / 100));
  
          ctx1.drawImage(img1, 0, topCrop, img1.width, bottomCrop - topCrop, 0, 0, img1.width, bottomCrop - topCrop);
          ctx2.drawImage(img2, 0, topCrop, img2.width, bottomCrop - topCrop, 0, 0, img2.width, bottomCrop - topCrop);
  
          // Get image data
          let data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
          let data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);
          
          // Get comparison method
          const method = comparisonMethod.value || 'default';
          
          // Use a more extensible approach with strategy pattern
          switch (method) {
            case 'basic':
              performBasicComparison(data1, data2, resolve);
              break;
            case 'default':
              performPerceptualComparison(data1, data2, resolve);
              break;
            // Easy to add more methods here
            default:
              performPerceptualComparison(data1, data2, resolve); // Default to advanced method
          }
        }
      }
  
      img1.onload = () => {
        loadedCount++;
        processImages();
      };
      
      img2.onload = () => {
        loadedCount++;
        processImages();
      };
  
      img1.src = img1Data;
      img2.src = img2Data;
    });
  }

  // Extract methods to separate functions
  function performBasicComparison(data1, data2, resolve) {
    data1 = convertToGrayscale(data1);
    data2 = convertToGrayscale(data2);
    
    data1 = applyGaussianBlur(data1, gaussianBlurSigma);
    data2 = applyGaussianBlur(data2, gaussianBlurSigma);
    
    const comparisonResult = comparePixels(data1, data2);
    
    resolve({
      changed: comparisonResult.changeRatio > changeRatioThreshold,
      changeRatio: comparisonResult.changeRatio,
      method: 'basic'
    });
  }

  function performPerceptualComparison(data1, data2, resolve) {
    try {
      // Calculate perceptual hashes
      const hash1 = calculatePerceptualHash(data1);
      const hash2 = calculatePerceptualHash(data2);
      
      // Calculate Hamming distance between hashes
      const hammingDistance = calculateHammingDistance(hash1, hash2);
      
      console.log(`pHash comparison: Hamming distance = ${hammingDistance}`);
      
      if (hammingDistance > hammingThresholdUp) {
        // Significant change detected by hash
        resolve({
          changed: true,
          changeRatio: hammingDistance / 64,
          method: 'pHash',
          distance: hammingDistance
        });
      } else if (hammingDistance <= hammingThresholdLow) {
        // Identical hashes
        resolve({
          changed: false,
          changeRatio: 0,
          method: 'pHash',
          distance: 0
        });
      } else {
        // Borderline case, use SSIM
        const ssim = calculateSSIM(data1, data2);
        console.log(`SSIM similarity: ${ssim.toFixed(6)}`);
        
        resolve({
          changed: ssim < ssimThreshold,
          changeRatio: 1.0 - ssim,
          method: 'SSIM',
          similarity: ssim
        });
      }
    } catch (error) {
      console.error('Error in advanced comparison:', error);
      performBasicComparison(data1, data2, resolve); // Fall back to basic method
    }
  }

  // Format date as local timestamp string suitable for filenames
  function formatLocalTimestamp() {
    const now = new Date();
    
    // Get local date components
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    // Format as YYYY-MM-DD_HH-MM-SS
    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  }
  
  // Start capturing slides
  async function startCapture() {
    // Clear auto-start check interval if it exists
    if (autoStartCheckInterval) {
      clearInterval(autoStartCheckInterval);
      autoStartCheckInterval = null;
    }
    
    const url = inputUrl.value;
    if (!url) {
      statusText.textContent = 'Please enter a URL';
      return;
    }
  
    // Only load the URL if webview is empty or about:blank
    if (webview.src === 'about:blank' || !webview.src) {
      webview.src = url;
    }
    
    btnStartCapture.disabled = true;
    btnStopCapture.disabled = false;
    updateStatus('capturing');
    
    // Setup the automatic cache cleanup timer
    setupCacheCleanupTimer();

    // Load the latest configuration values
    const config = await window.electronAPI.getConfig();
    gaussianBlurSigma = config.captureStrategy?.gaussianBlurSigma || 0.5;
    pixelDiffThreshold = config.captureStrategy.pixelDiffThreshold || 30;
    changeRatioThreshold = config.captureStrategy.changeRatioThreshold || 0.005;
    hammingThresholdLow = config.captureStrategy.hammingThresholdLow || 0;
    hammingThresholdUp = config.captureStrategy.hammingThresholdUp || 5;
    ssimThreshold = config.captureStrategy.ssimThreshold || 0.999;
    topCropPercent = config.topCropPercent || 5;
    bottomCropPercent = config.bottomCropPercent || 5;
    
    // Capture first slide
    try {
        // Check if we need to wait for video to load (for video-based profiles)
        if (activeProfileId !== 'default' && 
          siteProfiles[activeProfileId]?.elementSelector?.includes('video')) {
        
        updateStatus('waitingVideo');
        
        // Wait for video element to be ready
        let videoReady = false;
        let retryCount = 0;
        const maxRetries = 20; // Maximum 20 attempts (20 seconds)
        
        while (!videoReady && retryCount < maxRetries) {
          try {
            const videoCheck = await webview.executeJavaScript(`
              (function() {
                try {
                  const videoEl = document.querySelector('${siteProfiles[activeProfileId].elementSelector}');
                  
                  if (!videoEl) {
                    return { ready: false, reason: 'Video element not found' };
                  }
                  
                  // Check if video has metadata and dimensions
                  if (videoEl.readyState < 1) {
                    return { ready: false, reason: 'Video metadata not loaded', readyState: videoEl.readyState };
                  }
                  
                  // Check if video has valid dimensions
                  if (videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
                    return { ready: false, reason: 'Video dimensions not available', width: videoEl.videoWidth, height: videoEl.videoHeight };
                  }
                  
                  // Check if video has started buffering
                  if (videoEl.readyState < 3) {
                    return { 
                      ready: false, 
                      reason: 'Video not buffered enough', 
                      readyState: videoEl.readyState,
                      buffered: videoEl.buffered.length > 0 ? videoEl.buffered.end(0) : 0 
                    };
                  }
                  
                  return { 
                    ready: true, 
                    readyState: videoEl.readyState,
                    width: videoEl.videoWidth, 
                    height: videoEl.videoHeight 
                  };
                } catch (err) {
                  return { ready: false, error: err.toString() };
                }
              })();
            `);
            
            if (videoCheck.ready) {
              videoReady = true;
              console.log('Video is loaded and ready for capture:', videoCheck);
              updateStatus('capturing');
              // Reset counter when video is found successfully
              videoElementNotFoundCounter = 0;
            } else {
              console.log(`Video not ready (attempt ${retryCount + 1}/${maxRetries}):`, videoCheck);

              // Increment counter specifically for "Video element not found" errors
              if (videoCheck.reason === 'Video element not found') {
                videoElementNotFoundCounter++;
                console.log(`Video element not found count: ${videoElementNotFoundCounter}/${MAX_VIDEO_NOT_FOUND_ERRORS}`);
              }

              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
              retryCount++;
              updateStatus('waitingVideoRetry', { retryCount, maxRetries });
            }
          } catch (checkError) {
            console.error('Error checking video status:', checkError);
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
          }
        }
        
        if (!videoReady) {
          console.warn('Proceeding with capture despite video not being fully ready');
          statusText.textContent = 'Video may not be fully loaded, but proceeding...';
          
          // Add an extra delay as a last resort
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Use local timestamp instead of ISO string
      const timestamp = formatLocalTimestamp();
      const imageData = await captureScreenshot();


      
      // Check if the image is valid (not empty)
      const isValidImage = await validateImage(imageData);
      if (!isValidImage) {
        console.error('First captured image is invalid or empty');
        statusText.textContent = 'Error: Empty screenshot. Retrying...';
        
        // Wait a bit longer and try again
        await new Promise(resolve => setTimeout(resolve, 3000));
        const retryImageData = await captureScreenshot();
        
        // Validate the retry image
        const isRetryValid = await validateImage(retryImageData);
        if (!isRetryValid) {
          throw new Error('Failed to capture valid screenshot after retry');
        }
        
        // Use the valid retry image
        lastImageData = retryImageData;
      } else {
        // Store the uncropped image for comparison
        lastImageData = imageData;
      }
      
      // If using element capture, don't crop the image
      const isUsingElementCapture = activeProfileId !== 'default';
      const finalImageData = isUsingElementCapture ? imageData : await cropImage(imageData);
      
      // Pass the title to the save function
      await window.electronAPI.saveSlide({ 
        imageData: finalImageData, 
        timestamp,
        title: currentTitleText
      });
      
      capturedCount++;
      updateSlideCountText(capturedCount);

      // Get the effective check interval considering fast mode
      const effectiveCheckInterval = getEffectiveCheckInterval();
      
      // Start interval for checking slide changes
      captureInterval = setInterval(async () => {
        const playbackEnded = await checkPlaybackEnded();
        if (playbackEnded) return;
        
        const currentImageData = await captureScreenshot();

        // Add validation for each new captured image
        const isValidImage = await validateImage(currentImageData);
        if (!isValidImage) {
          console.warn('Captured invalid/empty image during interval, skipping this frame');
          return; // Skip this cycle if the image is invalid
        }

        if (enableDoubleVerification && verificationState !== 'none') {
          const verifyResult = await compareImages(potentialNewImageData, currentImageData);
          
          if (verifyResult.changed) {
            console.log(`Verification failed (attempt ${currentVerification}/${verificationCount}): new slide is unstable`);
            verificationState = 'none';
            currentVerification = 0;
            potentialNewImageData = null;
            verificationMethod = null;
          } else {
            currentVerification++;
            
            if (currentVerification < verificationCount) {
              console.log(`Verification ${currentVerification}/${verificationCount} passed, continuing verification`);
            } else {
              console.log(`All ${verificationCount} verifications passed, saving new slide`);
              const timestamp = formatLocalTimestamp();
              lastImageData = potentialNewImageData;
              const isUsingElementCapture = activeProfileId !== 'default';
              const finalImageData = isUsingElementCapture ? potentialNewImageData : await cropImage(potentialNewImageData);
              await window.electronAPI.saveSlide({ imageData: finalImageData, timestamp, title: currentTitleText });
              capturedCount++;
              updateSlideCountText(capturedCount);
              verificationState = 'none';
              currentVerification = 0;
              potentialNewImageData = null;
              verificationMethod = null;
            }
          }
        } else {
          const result = await compareImages(lastImageData, currentImageData);
    
          if (result.changed) {
            if (enableDoubleVerification) {
              console.log(`Potential slide change detected, starting verification (will perform ${verificationCount} checks)`);
              verificationState = 'verifying';
              currentVerification = 0;
              potentialNewImageData = currentImageData;
              verificationMethod = result.method;
            } else {
              const timestamp = formatLocalTimestamp();
              lastImageData = currentImageData;
              const isUsingElementCapture = activeProfileId !== 'default';
              const finalImageData = isUsingElementCapture ? currentImageData : await cropImage(currentImageData);
              await window.electronAPI.saveSlide({ imageData: finalImageData, timestamp, title: currentTitleText });
              capturedCount++;
              updateSlideCountText(capturedCount);
            }
            console.log(`${enableDoubleVerification ? 'Potential' : 'Saved'} new slide (method: ${result.method})`);
          }
        }
      }, effectiveCheckInterval * 1000); // Use the effective check interval

      // Set up error checking if enabled
      if (activeProfileId !== 'default' && 
          siteProfiles[activeProfileId]?.automation?.autoRetryError) {
        
        // Reset counter
        errorRetryAttempts = 0;
        
        // Set up interval for checking errors
        if (errorCheckInterval) {
          clearInterval(errorCheckInterval);
        }
        
        errorCheckInterval = setInterval(checkForPlaybackErrors, 5000); // Check every 5 seconds
      }
    } catch (error) {
      console.error('Error starting capture:', error);
      statusText.textContent = 'Error: ' + error.message;

      // Ensure buttons are re-enabled on error
      btnStartCapture.disabled = false;
      btnStopCapture.disabled = true;
    }
  }

  // Add a function to validate image data
  async function validateImage(imageData) {
    return new Promise((resolve) => {
      if (!imageData || imageData.length < 100) {
        resolve(false);
        return;
      }
      
      const img = new Image();
      img.onload = () => {
        // Check if the image has valid dimensions
        if (img.width > 0 && img.height > 0) {
          // Quick check for blank image by sampling just a few pixels
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          
          // Draw the image to canvas
          ctx.drawImage(img, 0, 0);
          
          // Sample just 5 strategic pixels instead of the whole image
          // Check center and corners to efficiently detect content
          const checkPoints = [
            [Math.floor(img.width/2), Math.floor(img.height/2)],           // Center
            [300, 300],                                                       // Top-left
            [img.width - 300, 300],                                           // Top-right
            [300, img.height - 300],                                          // Bottom-left
            [img.width - 300, img.height - 300]                               // Bottom-right
          ];
          
          let hasContent = false;
          for (const [x, y] of checkPoints) {
            const pixel = ctx.getImageData(x, y, 1, 1).data;
            // Consider non-black, non-transparent pixel as content
            // Alpha > 5 and any RGB channel > 5
            if (pixel[3] > 5 && (pixel[0] > 5 || pixel[1] > 5 || pixel[2] > 5)) {
              hasContent = true;
              break; // Early return once content is found
            }
          }
          
          resolve(hasContent);
        } else {
          resolve(false);
        }
      };
      
      img.onerror = () => {
        resolve(false);
      };
      
      img.src = imageData;
    });
  }
  
  // Stop capturing slides
  async function stopCapture() {
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
      
      // Clear any cache cleanup timer
      if (cacheCleanupTimer) {
        clearInterval(cacheCleanupTimer);
        cacheCleanupTimer = null;
      }

      // Disable auto-mute if enabled
      if (autoMuteEnabled) {
        try {
          const result = await window.electronAPI.unmuteWebviewAudio(webview.id);
          console.log('Auto-unmute result:', result);
          
          const muteIndicator = document.getElementById('muteIndicator');
          if (muteIndicator) {
            muteIndicator.remove();
          }
        } catch (unmuteError) {
          console.error('Error removing auto-mute:', unmuteError);
        }
      }

      try {
        await window.electronAPI.disableBackgroundRunning();
        console.log('Background running disabled after capture');
      } catch (error) {
        console.error('Failed to disable background running:', error);
      }

      // Explicitly reset Fast Mode activation state
      if (isProcessingTasks && fastModeEnabled) {
        console.log('Resetting Fast Mode activation state after capture');
        // Remove Fast Mode indicator if present
        const fastModeIndicator = document.getElementById('fastModeIndicator');
        if (fastModeIndicator) fastModeIndicator.remove();
      }
      
      // Clear ALL intervals and reset ALL state
      if (speedAdjustInterval) {
        clearInterval(speedAdjustInterval);
        speedAdjustInterval = null;
      }
      
      if (autoStartCheckInterval) {
        clearInterval(autoStartCheckInterval);
        autoStartCheckInterval = null;
      }
      
      // Reset ALL state flags completely
      speedAdjusted = false;
      speedAdjustRetryAttempts = 0;
      playbackRetryAttempts = 0;
      errorRetryAttempts = 0;
      videoElementNotFoundCounter = 0;

      // Reset verification state
      verificationState = 'none';
      potentialNewImageData = null;
      verificationMethod = null;
      lastImageData = null;

      btnStartCapture.disabled = false;
      btnStopCapture.disabled = true;
      
      // Clean up cache after stopping
      window.electronAPI.clearBrowserCache()
        .then(() => {
          return updateCacheInfo();
        })
        .then(() => {
          updateStatus('captureStoppedCacheCleared', {}, 3000);
        })
        .catch(error => {
          console.error('Error cleaning cache on stop:', error);
          statusText.textContent = 'Capture stopped';
        });
      speedAdjusted = false;
    }
  }
  
  // Set event listeners for page loading
  webview.addEventListener('did-start-loading', () => {
    // reset loading overlay
    loadingOverlay.classList.remove('timeout');
    loadingOverlay.innerHTML = '<div class="spinner"></div><span class="loading-text">Loading content...</span>';
    loadingOverlay.style.display = 'flex';

    updateStatus('loadingPage');
    titleDisplay.textContent = '';
    titleDisplay.style.display = 'none';
    currentTitleText = ''; // Clear current title
    
    // Clear any existing timeout
    if (loadingMessageTimeoutId) {
      clearTimeout(loadingMessageTimeoutId);
    }
    
    // Set new timeout to update message after 10 seconds
    loadingMessageTimeoutId = setTimeout(updateLoadingMessage, 10000);
    
    // Inject early link handling script
    webview.executeJavaScript(`
      (function() {
        // Only set if not already set
        if (!window._autoSlidesEarlyLinkHandlerInstalled) {
          window._autoSlidesEarlyLinkHandlerInstalled = true;
          
          // Override window.open immediately
          const originalWindowOpen = window.open;
          window.open = function(url, name, features) {
            if (url) {
              console.log('Early interception of window.open:', url);
              setTimeout(() => location.href = url, 0);
              return {
                closed: false,
                close: function() {},
                focus: function() {},
                document: document
              };
            }
            return null;
          };
          
          // Add early click handler
          document.addEventListener('click', function(event) {
            const link = event.target.closest('a');
            if (!link) return;
            
            if (link.target === '_blank' || event.ctrlKey || event.metaKey) {
              event.preventDefault();
              event.stopPropagation();
              if (link.href) {
                console.log('Early interception of link click:', link.href);
                location.href = link.href;
              }
            }
          }, true);
          
          console.log('Early AutoSlides link handler installed');
        }
      })();
    `).catch(err => console.error('Error injecting early link handler:', err));
  });
  
  webview.addEventListener('did-finish-load', () => {
    loadingOverlay.classList.remove('timeout');
    loadingOverlay.style.display = 'none';

    if (loadingMessageTimeoutId) {
      clearTimeout(loadingMessageTimeoutId);
      loadingMessageTimeoutId = null;
    }
    // Update URL field only if user isn't editing
    if (!userIsEditingUrl && webview.src) {
      inputUrl.value = webview.src;
    }
    
    // Short delay to ensure page is fully rendered
    setTimeout(() => {
      applyBlockingRules();
    }, 200);
    
    // Add this block for auto-start playback check
    if (activeProfileId !== 'default' && 
        siteProfiles[activeProfileId]?.automation?.autoStartPlayback && 
        urlMatchesProfilePatterns(webview.src, activeProfileId)) {
      
      console.log('URL matches profile pattern, initiating auto-start playback check');
      
      // Clear any existing interval
      if (autoStartCheckInterval) {
        clearInterval(autoStartCheckInterval);
      }
      
      // Reset retry counter
      playbackRetryAttempts = 0;
      
      // Call immediately and then set up interval
      checkAndAutoStartPlayback();
      autoStartCheckInterval = setInterval(checkAndAutoStartPlayback, 2000);
    }
    // Add a slight delay to ensure page content is loaded
    setTimeout(() => {
      detectAndDisplayTitle();
    }, 1000);
  });

  webview.addEventListener('did-fail-load', (event) => {
    loadingOverlay.classList.remove('timeout');
    loadingOverlay.style.display = 'none';

    if (loadingMessageTimeoutId) {
      clearTimeout(loadingMessageTimeoutId);
      loadingMessageTimeoutId = null;
    }
    if (event.errorCode !== -3) { // Ignore aborted loads
      statusText.textContent = `Load failed: ${event.errorDescription}`;
    }
  });

  // Comprehensive did-navigate event handler
  webview.addEventListener('did-navigate', async (e) => {
    // Update URL field only if user isn't editing
    if (!userIsEditingUrl) {
      inputUrl.value = e.url;
    }
    updateStatus('pageLoaded');
    
    const url = e.url;
  
    // Check URL pattern for YanHeKT course pages
    if (url.includes('yanhekt.cn/course/')) {
      try {
        console.log('Detected YanHeKT course page:', url);
        await detectYanHeKTCourse(url);
      } catch (error) {
        console.error('Error detecting YanHeKT course:', error);
      }
    }
  
    // Check URL pattern for YanHeKT live course pages
    if (url.includes('yanhekt.cn/liveCourse')) {
      try {
        console.log('Detected YanHeKT live course page:', url);
        await detectYanHeKTLiveCourse(url);
      } catch (error) {
        console.error('Error detecting YanHeKT live course:', error);
      }
    }
  
    // Check for profile switching based on URL patterns
    checkAndSwitchProfile(url);
    
    // Ensure clean state after navigation
    speedAdjusted = false;
    if (speedAdjustInterval) {
      clearInterval(speedAdjustInterval);
      speedAdjustInterval = null;
    }
    speedAdjustRetryAttempts = 0;
    
    // Reset title display before detecting new title
    titleDisplay.textContent = '';
    titleDisplay.style.display = 'none';
    
    // Add a slight delay to ensure page content is loaded before detecting title
    setTimeout(() => {
      detectAndDisplayTitle();
    }, 1000);
  });

  // Comprehensive in-page navigation handler
  webview.addEventListener('did-navigate-in-page', async (e) => {
    loadingOverlay.style.display = 'none';
    if (e.isMainFrame && e.url) {
      // Update URL field only if user isn't editing
      if (!userIsEditingUrl) {
        inputUrl.value = e.url;
      }
    }
    
    const url = e.url;

      // Check URL pattern for YanHeKT course pages
    if (url.includes('yanhekt.cn/course/')) {
      try {
        console.log('Detected YanHeKT course page (in-page):', url);
        await detectYanHeKTCourse(url);
      } catch (error) {
        console.error('Error detecting YanHeKT course (in-page):', error);
      }
    }
    
    // Check URL pattern for YanHeKT live course pages
    if (url.includes('yanhekt.cn/liveCourse')) {
      try {
        console.log('Detected YanHeKT live course page (in-page):', url);
        await detectYanHeKTLiveCourse(url);
      } catch (error) {
        console.error('Error detecting YanHeKT live course (in-page):', error);
      }
    }
    
    // Check for profile switching
    checkAndSwitchProfile(url);
    
    // Add a slight delay to ensure page content is loaded
    setTimeout(() => {
      detectAndDisplayTitle();
    }, 1000);
  });
  
  webview.addEventListener('new-window', (e) => {
    e.preventDefault();
    if (e.url) {
      console.log('Intercepted new window:', e.url);
      safeLoadURL(e.url);
    }
  });
  
  // Integrated approach that preserves link handling while adding YanHeKT functionality
  webview.addEventListener('dom-ready', () => {
    webview.executeJavaScript(`
      (function() {
        // Only set up link handler once
        if (!window._autoSlidesLinkHandlerInstalled) {
          window._autoSlidesLinkHandlerInstalled = true;
          
          // Override window.open
          const originalWindowOpen = window.open;
          window.open = function(url, name, features) {
            if (url) {
              console.log('Intercepted window.open:', url);
              // Use location.href to navigate in the same window
              setTimeout(() => location.href = url, 0);
              
              // Return a mock window object
              return {
                closed: false,
                close: function() {},
                focus: function() {},
                document: document
              };
            }
            return null;
          };
          
          // Handle target="_blank" links
          document.addEventListener('click', function(event) {
            const link = event.target.closest('a');
            if (!link) return;
            
            // Handle _blank links or cmd/ctrl+click
            if (link.target === '_blank' || event.ctrlKey || event.metaKey) {
              event.preventDefault();
              event.stopPropagation();
              
              if (link.href) {
                console.log('Intercepted link click:', link.href);
                location.href = link.href;
              }
            }
          }, true);
          
          console.log('AutoSlides link handler installed');
        }
  
        // Check if we're on a YanHeKT course or live course page and notify main process
        if (window.location.href.includes('yanhekt.cn/course/')) {
          console.log('YanHeKT course page detected, will process after page fully loads');
        } else if (window.location.href.includes('yanhekt.cn/liveCourse')) {
          console.log('YanHeKT live course page detected, will process after page fully loads');
        }
      })();
    `).catch(err => console.error('Error injecting link handler:', err));
    
    // Check URL pattern for YanHeKT pages after a delay to ensure page has fully loaded
    setTimeout(async () => {
      const url = await webview.executeJavaScript('window.location.href');
      if (url && url.includes('yanhekt.cn/course/')) {
        try {
          console.log('Delayed YanHeKT course page detection:', url);
          await detectYanHeKTCourse(url);
        } catch (error) {
          console.error('Error in delayed YanHeKT course detection:', error);
        }
      } else if (url && url.includes('yanhekt.cn/liveCourse')) {
        try {
          console.log('Delayed YanHeKT live course page detection:', url);
          await detectYanHeKTLiveCourse(url);
        } catch (error) {
          console.error('Error in delayed YanHeKT live course detection:', error);
        }
      }
    }, 1500);
  });

  // Update guides if webview size changes (e.g., when window is resized)
  window.addEventListener('resize', () => {
    if (cropGuides.classList.contains('visible')) {
      updateCropGuides();
    }
  });

  window.electronAPI.onShowCropGuides && window.electronAPI.onShowCropGuides(async () => {
    // Get latest crop settings from config
    const config = await window.electronAPI.getConfig();
    const topCropPercent = config.topCropPercent || 5;
    const bottomCropPercent = config.bottomCropPercent || 5;
    
    // Update the crop guide positions with these values
    updateCropGuidesFromConfig(topCropPercent, bottomCropPercent);
  });

  window.electronAPI.onUpdateCropPreview && window.electronAPI.onUpdateCropPreview((event, data) => {
    const { topCropPercent, bottomCropPercent } = data;
    // Update the crop guides with the received values
    updateCropGuidesFromConfig(topCropPercent, bottomCropPercent);
  });

  siteProfileSelect.addEventListener('change', () => {
    const profileId = siteProfileSelect.value;
    loadProfileDetails(profileId);
    activeProfileId = profileId;
    saveConfig();
    if (taskManagerModal.style.display === 'block') {
      validateAutomationRequirements();
    }
  });

  function updateCropGuidesFromConfig(topCropPercent, bottomCropPercent) {
    // Get webview dimensions
    const webviewHeight = webview.clientHeight;
    
    // Calculate pixel positions
    const topPosition = Math.floor(webviewHeight * (topCropPercent / 100));
    const bottomPosition = Math.floor(webviewHeight * (1 - bottomCropPercent / 100));
    
    // Update guide positions
    topCropGuide.style.top = `${topPosition}px`;
    bottomCropGuide.style.top = `${bottomPosition}px`;
    
    // Update info overlay with current crop percentages
    cropInfoOverlay.textContent = `Crop: Top ${topCropPercent}%, Bottom ${bottomCropPercent}%`;
    
    // Show the guides
    cropGuides.classList.add('visible');
    
    // Clear any existing timer
    if (cropGuideTimer) {
      clearTimeout(cropGuideTimer);
    }
    
    // Set timer to hide guides after 3 seconds
    cropGuideTimer = setTimeout(() => {
      cropGuides.classList.remove('visible');
    }, 3000);
  }

  // Update cache info initially 
  updateCacheInfo();

  // Set up periodic cache info updates
  setInterval(updateCacheInfo, 60000); // Update every minute

  // Add event listeners for all buttons
  btnStartCapture.addEventListener('click', startCapture);
  btnStopCapture.addEventListener('click', stopCapture);
  btnLoadUrl.addEventListener('click', loadURL);
  btnSelectDir.addEventListener('click', selectOutputDirectory);
  btnDefaultConfig.addEventListener('click', resetConfigToDefaults);
  btnClearCache.addEventListener('click', clearBrowserCache);

  // Add collapsible section functionality
  toggleAdvancedSettings.addEventListener('click', () => {
    advancedSettingsContent.classList.toggle('hidden');
    toggleAdvancedSettings.textContent = advancedSettingsContent.classList.contains('hidden') ? '▼' : '▲';
  });
  
  // Add enter key handling for URL input
  inputUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      // When Enter is pressed, blur the input to indicate user is done editing
      inputUrl.blur();
      userIsEditingUrl = false;
      loadURL();
    }
  });

  toggleAutomation.addEventListener('click', () => {
    automationContent.classList.toggle('hidden');
    toggleAutomation.textContent = automationContent.classList.contains('hidden') ? '▼' : '▲';
  });

  async function checkPlaybackEnded() {
    if (!captureInterval) return false;
    
    if (activeProfileId === 'default' || !siteProfiles[activeProfileId]?.automation?.autoDetectEnd) {
      return false;
    }
    
    const endSelector = siteProfiles[activeProfileId].automation.endDetectionSelector;
    if (!endSelector) return false;
    
    try {
      const result = await webview.executeJavaScript(`
        (function() {
          try {
            const endElement = document.querySelector('${endSelector}');
            return !!endElement && endElement.offsetParent !== null;
          } catch (err) {
            console.error('Error checking for playback end:', err);
            return false;
          }
        })();
      `);
      
      if (result) {
        console.log('Playback end detected, stopping capture');
        stopCapture();
        updateStatus('endPlayback');
        
        // If we're processing tasks, move to the next task
        if (isProcessingTasks) {
          console.log('Moving to next task in queue');
          currentTaskIndex++;
          
          // Slight delay before loading next task
          setTimeout(() => {
            processNextTask();
          }, 2000);
        }
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error in playback end detection:', error);
      return false;
    }
  }

  // Add this variable to track retry attempts
  let playbackRetryAttempts = 0;
  const MAX_RETRY_ATTEMPTS = 5;

  async function checkAndAutoStartPlayback() {
    // Only run auto-start if active profile is not default and has autoStartPlayback enabled
    if (activeProfileId === 'default' || 
        !siteProfiles[activeProfileId]?.automation?.autoStartPlayback) {
      return;
    }
    
    // Make sure URL matches patterns for this profile
    if (!urlMatchesProfilePatterns(webview.src, activeProfileId)) {
      return;
    }
    
    // Get the custom selectors
    const playBtnSelector = siteProfiles[activeProfileId]?.automation?.playButtonSelector || 
                            '.player-mid-button-container button';
    const countdownSel = siteProfiles[activeProfileId]?.automation?.countdownSelector || '';
    
    try {
      // First check if the video is already playing
      const playingCheck = await webview.executeJavaScript(`
        (function() {
          try {
            // Check if any video is already playing
            const videoElements = document.querySelectorAll('video');
            for (let i = 0; i < videoElements.length; i++) {
              const video = videoElements[i];
              if (!video.paused && !video.ended && video.currentTime > 0) {
                console.log('Video already playing:', video);
                return { playing: true, message: 'Video already playing' };
              }
            }
            return { playing: false };
          } catch (err) {
            console.error('Error checking video playing status:', err);
            return { error: err.toString() };
          }
        })();
      `);
      
      if (playingCheck.error) {
        console.error('Error checking if video is playing:', playingCheck.error);
        return;
      }
      
      if (playingCheck.playing) {
        if (autoStartCheckInterval) {
          clearInterval(autoStartCheckInterval);
          autoStartCheckInterval = null;
        }
        
        console.log('Video detected as playing, starting capture');
        playbackRetryAttempts = 0;
        
        // Start capture if not already capturing
        if (!captureInterval) {
          setTimeout(() => {
            console.log('Auto-starting capture after detecting playback');
            startCapture();
          }, 1000);
        }
        
        return;
      }
      
      // If video is not playing, check for play button and try to click it
      const buttonCheck = await webview.executeJavaScript(`
        (function() {
          try {
            const playButtonSelector = '${playBtnSelector}';
            const playButton = document.querySelector(playButtonSelector);
            
            if (playButton && playButton.offsetParent !== null) {
              const isVisible = window.getComputedStyle(playButton).display !== 'none';
              if (isVisible) {
                console.log('Found play button, clicking it');
                playButton.click();
                return { clicked: true };
              }
            }
            return { clicked: false };
          } catch (err) {
            console.error('Error clicking play button:', err);
            return { error: err.toString() };
          }
        })();
      `);
      
      if (buttonCheck.error) {
        console.error('Error checking for play button:', buttonCheck.error);
        return;
      }
      
      if (buttonCheck.clicked) {
        console.log('Play button clicked, waiting to verify playback started');
        
        // Wait a moment and then check if playback started
        setTimeout(async () => {
          try {
            const verifyPlayback = await webview.executeJavaScript(`
              (function() {
                try {
                  const videos = document.querySelectorAll('video');
                  for (let i = 0; i < videos.length; i++) {
                    const video = videos[i];
                    console.log('Video paused state:', video.paused);
                    if (!video.paused) {
                      return { playbackStarted: true };
                    }
                  }
                  return { playbackStarted: false, videoCount: document.querySelectorAll('video').length };
                } catch (err) {
                  return { error: err.toString() };
                }
              })();
            `);
            
            if (verifyPlayback.error) {
              console.error('Error verifying playback:', verifyPlayback.error);
              return;
            }
            
            if (verifyPlayback.playbackStarted) {
              // Button click was successful, playback started
              if (autoStartCheckInterval) {
                clearInterval(autoStartCheckInterval);
                autoStartCheckInterval = null;
              }
              
              updateStatus('startPlayback');
              playbackRetryAttempts = 0;
              
              // Wait a moment for video to stabilize before starting capture
              setTimeout(() => {
                if (!captureInterval) {
                  console.log('Auto-starting capture after playback began');
                  startCapture();
                }
              }, 2000);
              
              // Set up speed adjustment check interval based on the effective auto-adjust setting
              if (!speedAdjusted && 
                activeProfileId !== 'default' &&
                (getEffectiveAutoAdjustSpeed() || siteProfiles[activeProfileId]?.automation?.autoAdjustSpeed) && 
                siteProfiles[activeProfileId]?.automation?.speedSelector) {
                
                // Reset retry counter
                speedAdjustRetryAttempts = 0;
                
                // Clear any existing interval
                if (speedAdjustInterval) {
                  clearInterval(speedAdjustInterval);
                }

                console.log('Setting up speed adjustment with fast mode check');
                
                // Delay before starting speed adjustment checks
                setTimeout(() => {
                  // First try immediately
                  console.log('First attempt to adjust playback speed');
                  speedAdjusted = false; // Reset this flag before the check
                  checkAndAdjustPlaybackSpeed();
                  
                  // Then set up interval for retries if needed
                  speedAdjustInterval = setInterval(checkAndAdjustPlaybackSpeed, 2000);
                }, 1000); // 1 second delay before first attempt
              }
            } else {
              // Button click didn't start playback, retry if within attempts limit
              playbackRetryAttempts++;
              console.log(`Play button click didn't start video. Retry attempt ${playbackRetryAttempts}/${MAX_RETRY_ATTEMPTS}`);
              statusText.textContent = `Play attempt ${playbackRetryAttempts}/${MAX_RETRY_ATTEMPTS}...`;
              
              if (playbackRetryAttempts >= MAX_RETRY_ATTEMPTS) {
                console.log('Max retry attempts reached, giving up auto-start');
                statusText.textContent = 'Auto-start failed, manual play needed';
                playbackRetryAttempts = 0;
                
                if (autoStartCheckInterval) {
                  clearInterval(autoStartCheckInterval);
                  autoStartCheckInterval = null;
                }
              }
            }
          } catch (error) {
            console.error('Error in playback verification:', error);
          }
        }, 500); // Wait 500ms before checking if video started playing
        
        return;
      }
      
      // Check for countdown if selector is provided
      if (countdownSel) {
        const countdownCheck = await webview.executeJavaScript(`
          (function() {
            try {
              const countdown = document.querySelector('${countdownSel}');
              if (countdown && countdown.offsetParent !== null) {
                let timeInfo = '';
                const tip = document.querySelector('.countdown-tip');
                if (tip) {
                  timeInfo = tip.textContent;
                }
                return { found: true, type: 'countdown', info: timeInfo };
              }
              return { found: false };
            } catch (err) {
              return { error: err.toString() };
            }
          })();
        `);
        
        if (countdownCheck.error) {
          console.error('Error checking for countdown:', countdownCheck.error);
          return;
        }
        
        if (countdownCheck.found) {
          console.log('Detected countdown:', countdownCheck.info);
          updateStatus('waitingLiveStream', { info: countdownCheck.info.trim() });
          // Reset retry counter when waiting for countdown
          playbackRetryAttempts = 0;
        }
      }
    } catch (error) {
      console.error('Error in checkAndAutoStartPlayback:', error);
    }
  }

  // Add this new function for checking and adjusting playback speed
  async function checkAndAdjustPlaybackSpeed() {
    // Use the effective auto-adjust speed setting that considers fast mode
    const shouldAdjustSpeed = getEffectiveAutoAdjustSpeed();

    // If we're in fast mode, log this explicitly
    if (isProcessingTasks && fastModeEnabled) {
      console.log('Fast Mode is active - will force speed adjustment');
    }

    // Clean up interval if already adjusted or profile has no selector
    if (speedAdjusted || 
        activeProfileId === 'default' || 
        !siteProfiles[activeProfileId]?.automation?.speedSelector) {
      
      // Clean up interval if it exists
      if (speedAdjustInterval) {
        clearInterval(speedAdjustInterval);
        speedAdjustInterval = null;
      }
      return;
    }

    if (!shouldAdjustSpeed) {
      // If fast mode is not forcing speed adjustment and user has disabled it
      console.log('Speed adjustment not enabled - skipping (fast mode not active)');
      
      // Clean up and return
      if (speedAdjustInterval) {
        clearInterval(speedAdjustInterval);
        speedAdjustInterval = null;
      }
      return;
    }
    
    console.log('Proceeding with speed adjustment check');

    try {
      // First check if the video is actually playing
      const playingCheck = await webview.executeJavaScript(`
        (function() {
          try {
            const speedSelector = '${siteProfiles[activeProfileId].automation.speedSelector}';
            const videoEl = document.querySelector(speedSelector);
            
            if (!videoEl) {
              return { success: false, error: 'Video element not found', playing: false };
            }
            
            return { 
              success: true, 
              playing: !videoEl.paused && !videoEl.ended && videoEl.currentTime > 0,
              currentSpeed: videoEl.playbackRate
            };
          } catch (err) {
            return { success: false, error: err.toString(), playing: false };
          }
        })();
      `);
      
      if (!playingCheck.success) {
        console.error('Error checking video playback status:', playingCheck.error);
        statusText.textContent = 'Error checking video status';
        
        // Increment retry counter
        speedAdjustRetryAttempts++;
        if (speedAdjustRetryAttempts >= MAX_SPEED_ADJUST_ATTEMPTS) {
          console.log('Max speed adjustment retry attempts reached');
          clearInterval(speedAdjustInterval);
          speedAdjustInterval = null;
        }
        return;
      }
      
      if (!playingCheck.playing) {
        console.log('Video not playing yet, cannot adjust speed');
        return; // Try again on next interval
      }
      
      // Get effective target speed
      const targetSpeed = getEffectiveTargetSpeed();
      console.log(`Target speed is ${targetSpeed}x (fast mode: ${isProcessingTasks && fastModeEnabled ? 'active' : 'inactive'})`);
      
      // Check if speed is already set correctly
      if (playingCheck.currentSpeed === targetSpeed) {
        console.log(`Playback speed is already at target ${targetSpeed}x`);
        speedAdjusted = true;
        clearInterval(speedAdjustInterval);
        speedAdjustInterval = null;
        
        // Reset status text after 3 seconds
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      // If we get here, we need to adjust the speed
      console.log(`Adjusting playback speed to ${targetSpeed}x (current: ${playingCheck.currentSpeed}x)`);
      updateStatus('setPlaybackSpeed', { speed: targetSpeed });
      
      const result = await webview.executeJavaScript(`
        (function() {
          try {
            const speedSelector = '${siteProfiles[activeProfileId].automation.speedSelector}';
            const videoEl = document.querySelector(speedSelector);
            
            if (!videoEl) {
              return { success: false, error: 'Video element not found for speed adjustment' };
            }
            
            // Store original speed for comparison
            const originalSpeed = videoEl.playbackRate;
            
            // Set the new speed
            videoEl.playbackRate = ${targetSpeed};
            
            // Verify the speed was actually changed
            if (videoEl.playbackRate !== ${targetSpeed}) {
              return { 
                success: false, 
                error: 'Speed setting was not applied', 
                requestedSpeed: ${targetSpeed},
                actualSpeed: videoEl.playbackRate
              };
            }
            
            return { 
              success: true, 
              actualSpeed: videoEl.playbackRate,
              originalSpeed: originalSpeed
            };
          } catch(err) {
            return { success: false, error: err.toString() };
          }
        })();
      `);
      
      if (result.success) {
        console.log(`Playback speed set to ${result.actualSpeed}x (was ${result.originalSpeed}x)`);
        speedAdjusted = true;
        
        // Clean up interval
        clearInterval(speedAdjustInterval);
        speedAdjustInterval = null;
        
        // Reset status text after 3 seconds
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
      } else {
        console.error('Failed to adjust playback speed:', result.error);
        speedAdjustRetryAttempts++;
        statusText.textContent = `Speed adjustment failed, retry ${speedAdjustRetryAttempts}/${MAX_SPEED_ADJUST_ATTEMPTS}`;
        
        if (speedAdjustRetryAttempts >= MAX_SPEED_ADJUST_ATTEMPTS) {
          console.log('Max speed adjustment retry attempts reached');
          clearInterval(speedAdjustInterval);
          speedAdjustInterval = null;
          
          setTimeout(() => {
            updateStatusConditional(captureInterval, 'capturing', 'idle');
          }, 2000);
        }
      }
    } catch (error) {
      console.error('Error in checkAndAdjustPlaybackSpeed:', error);
      speedAdjustRetryAttempts++;
      
      if (speedAdjustRetryAttempts >= MAX_SPEED_ADJUST_ATTEMPTS) {
        clearInterval(speedAdjustInterval);
        speedAdjustInterval = null;
      }
    }
  }

  // Add function to check for playback errors
  async function checkForPlaybackErrors() {
    // Skip if not in automation mode or feature not enabled
    if (activeProfileId === 'default' || 
        !siteProfiles[activeProfileId]?.automation?.autoRetryError) {
      return;
    }

    // Check for excessive "Video element not found" errors
    if (videoElementNotFoundCounter >= MAX_VIDEO_NOT_FOUND_ERRORS) {
      console.log(`Too many "Video element not found" errors (${videoElementNotFoundCounter}/${MAX_VIDEO_NOT_FOUND_ERRORS}), treating as playback error`);
      
      // Check if we've exceeded max retries
      const maxAttempts = parseInt(siteProfiles[activeProfileId].automation.maxRetryAttempts || '3', 10);
      
      if (errorRetryAttempts >= maxAttempts) {
        console.log(`Max retry attempts (${maxAttempts}) reached, giving up`);
        statusText.textContent = `Error: Playback failed after ${maxAttempts} retry attempts`;
        
        // Clean up interval
        if (errorCheckInterval) {
          clearInterval(errorCheckInterval);
          errorCheckInterval = null;
        }
        return;
      }
      
      // Increment counter and reload page
      errorRetryAttempts++;
      statusText.textContent = `Video element not found error. Retrying (${errorRetryAttempts}/${maxAttempts})...`;
      
      // Reset video not found counter
      videoElementNotFoundCounter = 0;

      try {
        console.log('Clearing browser cache before reload attempt');
        await window.electronAPI.clearBrowserCache();
      } catch (cacheError) {
        console.error('Error clearing cache during retry:', cacheError);
      }
      
      // Wait a moment before reloading
      setTimeout(() => {
        console.log(`Reloading page, attempt ${errorRetryAttempts}/${maxAttempts}`);
        webview.reload();
      }, 1000);
      
      return; // Exit early after handling video not found error
    }

    // Continue with regular error selector check
    if (!siteProfiles[activeProfileId]?.automation?.errorSelector) {
      return;
    }
    
    try {
      const result = await webview.executeJavaScript(`
        (function() {
          try {
            const errorSelector = '${siteProfiles[activeProfileId].automation.errorSelector}';
            const errorEl = document.querySelector(errorSelector);
            
            return { 
              success: true, 
              errorDetected: !!errorEl,
              errorMessage: errorEl ? errorEl.textContent.trim() : ''
            };
          } catch (err) {
            return { success: false, error: err.toString() };
          }
        })();
      `);
      
      if (!result.success) {
        console.error('Error checking for playback errors:', result.error);
        return;
      }
      
      if (result.errorDetected) {
        console.log('Playback error detected:', result.errorMessage);
        
        // Check if we've exceeded max retries
        const maxAttempts = parseInt(siteProfiles[activeProfileId].automation.maxRetryAttempts || '3', 10);
        
        if (errorRetryAttempts >= maxAttempts) {
          console.log(`Max retry attempts (${maxAttempts}) reached, giving up`);
          statusText.textContent = `Error: Playback failed after ${maxAttempts} retry attempts`;
          
          // Clean up interval
          if (errorCheckInterval) {
            clearInterval(errorCheckInterval);
            errorCheckInterval = null;
          }
          return;
        }
        
        // Increment counter and reload page
        errorRetryAttempts++;
        updateStatus('playbackRetry', {
          retryCount: errorRetryAttempts,
          maxRetries: maxAttempts,
        });

        try {
          console.log('Clearing browser cache before reload attempt');
          await window.electronAPI.clearBrowserCache();
        } catch (cacheError) {
          console.error('Error clearing cache during retry:', cacheError);
        }
        
        // Wait a moment before reloading
        setTimeout(() => {
          console.log(`Reloading page, attempt ${errorRetryAttempts}/${maxAttempts}`);
          webview.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('Error in checkForPlaybackErrors:', error);
    }
  }

  // Add this function to check URL against profile patterns
  function urlMatchesProfilePatterns(url, profileId) {
    if (!profileId || profileId === 'default' || !siteProfiles[profileId]) {
      return false;
    }
    
    const profile = siteProfiles[profileId];
    if (!profile.urlPattern) {
      return false;
    }
    
    const patterns = profile.urlPattern.split(' ');
    for (const pattern of patterns) {
      if (pattern && url.includes(pattern)) {
        return true;
      }
    }
    return false;
  }

  // Add the title detection function
  async function detectAndDisplayTitle() {
    // Only run if active profile is not default and has autoDetectTitle enabled
    if (activeProfileId === 'default' || 
        !siteProfiles[activeProfileId]?.automation?.autoDetectTitle) {
      titleDisplay.textContent = '';
      titleDisplay.style.display = 'none';
      currentTitleText = ''; // Clear current title
      return;
    }
    
    // Make sure URL matches patterns for this profile
    if (!urlMatchesProfilePatterns(webview.src, activeProfileId)) {
      titleDisplay.textContent = '';
      titleDisplay.style.display = 'none';
      currentTitleText = ''; // Clear current title
      return;
    }
    
    // Get the selectors from the active profile
    const courseTitleSel = siteProfiles[activeProfileId]?.automation?.courseTitleSelector || '';
    const sessionInfoSel = siteProfiles[activeProfileId]?.automation?.sessionInfoSelector || '';
    
    if (!courseTitleSel && !sessionInfoSel) {
      titleDisplay.textContent = '';
      titleDisplay.style.display = 'none';
      currentTitleText = ''; // Clear current title
      return;
    }
    
    try {
      // Extract title information
      const titleInfo = await webview.executeJavaScript(`
        (function() {
          try {
            const result = {};
            
            // Extract course title
            if ('${courseTitleSel}') {
              const courseElem = document.querySelector('${courseTitleSel}');
              if (courseElem) {
                result.courseTitle = courseElem.textContent.trim();
              }
            }
            
            // Extract session information
            if ('${sessionInfoSel}') {
              const sessionElem = document.querySelector('${sessionInfoSel}');
              if (sessionElem) {
                result.sessionInfo = sessionElem.textContent.trim();
                
                // Try to parse week and day information using regex
                const weekMatch = result.sessionInfo.match(/第(\\d+)周/);
                const dayMatch = result.sessionInfo.match(/星期([一二三四五六日])/);
                
                if (weekMatch && weekMatch[1]) {
                  result.weekNumber = weekMatch[1];
                }
                
                if (dayMatch && dayMatch[1]) {
                  // Convert Chinese day to English abbreviation with first letter capitalized
                  const dayMap = {
                    '一': 'Mon', '二': 'Tue', '三': 'Wed', '四': 'Thu',
                    '五': 'Fri', '六': 'Sat', '日': 'Sun'
                  };
                  result.dayOfWeek = dayMap[dayMatch[1]] || dayMatch[1];
                }
              }
            }
            
            return result;
          } catch (err) {
            console.error('Error extracting title information:', err);
            return null;
          }
        })();
      `);
      
      if (titleInfo) {
        let titleDisplayText = '';
        
        if (titleInfo.courseTitle) {
          titleDisplayText += titleInfo.courseTitle;
        }
        
        if (titleInfo.weekNumber && titleInfo.dayOfWeek) {
          if (titleDisplayText) titleDisplayText += ' '; // Space instead of ' - '
          titleDisplayText += `Week ${titleInfo.weekNumber} ${titleInfo.dayOfWeek}`; // Capitalize 'Week'
        } else if (titleInfo.sessionInfo) {
          if (titleDisplayText) titleDisplayText += ' '; // Space instead of ' - '
          titleDisplayText += titleInfo.sessionInfo;
        }
        
        if (titleDisplayText) {
          // Update the dedicated title element
          titleDisplay.textContent = titleDisplayText;
          titleDisplay.style.display = 'block';
          currentTitleText = titleDisplayText; // Store the title for saving
        } else {
          titleDisplay.textContent = '';
          titleDisplay.style.display = 'none';
          currentTitleText = ''; // Clear current title
        }
      } else {
        titleDisplay.textContent = '';
        titleDisplay.style.display = 'none';
        currentTitleText = ''; // Clear current title
      }
    } catch (error) {
      console.error('Error in title detection:', error);
      titleDisplay.textContent = '';
      titleDisplay.style.display = 'none';
      currentTitleText = ''; // Clear current title
    }
  }


  // Task Manager elements
  const btnOpenTaskManager = document.getElementById('btnOpenTaskManager');
  const taskManagerModal = document.getElementById('taskManagerModal');
  const closeTaskManager = document.getElementById('closeTaskManager');
  const taskProfileSelect = document.getElementById('taskProfileSelect');
  const taskIdInput = document.getElementById('taskIdInput');
  const btnAddTask = document.getElementById('btnAddTask');
  const taskTableBody = document.getElementById('taskTableBody');
  const btnStartTasks = document.getElementById('btnStartTasks');
  const btnCancelTasks = document.getElementById('btnCancelTasks');
  const btnClearTasks = document.getElementById('btnClearTasks');
  const taskValidationMessage = document.getElementById('taskValidationMessage');
  const resetProgressCheckbox = document.getElementById('resetProgressCheckbox');

  // Task management variables
  let taskQueue = [];
  let isProcessingTasks = false;
  let currentTaskIndex = -1;

  // Task Manager functions
  function openTaskManager() {
    // Populate the profile dropdown
    populateTaskProfiles();
    
    // Check if automation requirements are met
    validateAutomationRequirements();
    
    // Set checkboxes from the global variables (loaded from config)
    fastModeCheckbox.checked = fastModeEnabled;
    resetProgressCheckbox.checked = resetVideoProgress;
    autoMuteCheckbox.checked = autoMuteEnabled;
    
    // Display the modal
    taskManagerModal.style.display = 'block';
  }

  function closeTaskManagerModal() {
    taskManagerModal.style.display = 'none';
  }

  function populateTaskProfiles() {
    // Clear existing options
    taskProfileSelect.innerHTML = '';
    
    // Add profiles (excluding default which doesn't support automation)
    for (const [id, profile] of Object.entries(siteProfiles)) {
      if (id !== 'default' && profile.urlPattern) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = profile.name || id;
        taskProfileSelect.appendChild(option);
      }
    }
    
    // Add custom option
    const customOption = document.createElement('option');
    customOption.value = 'custom';
    customOption.textContent = 'Custom URL';
    taskProfileSelect.appendChild(customOption);
  }

  function validateAutomationRequirements() {
    // Get the profile selected in the task manager, not the globally active profile
    const selectedProfileId = taskProfileSelect.value;
    
    // Check if the selected profile has the required automation settings
    let isValid = true;
    let message = '';
    
    if (selectedProfileId === 'custom') {
      // Custom URL doesn't need validation of automation settings
      taskValidationMessage.textContent = '';
      btnStartTasks.disabled = taskQueue.length === 0 || isProcessingTasks;
      return true;
    }
    
    if (!selectedProfileId || !siteProfiles[selectedProfileId]) {
      isValid = false;
      message = 'Please select a valid profile';
    } else {
      const profile = siteProfiles[selectedProfileId];
      const automation = profile.automation || {};
      
      if (!automation.autoDetectEnd) {
        isValid = false;
        message = `"Auto-detect playback end" must be enabled for ${profile.name}`;
      } else if (!automation.autoStartPlayback) {
        isValid = false;
        message = `"Auto-start playback" must be enabled for ${profile.name}`;
      } else if (!automation.autoDetectTitle) {
        isValid = false;
        message = `"Auto-detect title" must be enabled for ${profile.name}`;
      }
    }
    
    // Update UI
    btnStartTasks.disabled = !isValid || taskQueue.length === 0 || isProcessingTasks;
    
    if (!isValid) {
      taskValidationMessage.textContent = message;
    } else {
      taskValidationMessage.textContent = '';
    }
    
    return isValid;
  }

  function addTask() {
    const profileId = taskProfileSelect.value;
    const taskId = taskIdInput.value.trim();
    
    // Validation
    if (!profileId) {
      taskValidationMessage.textContent = 'Please select a profile';
      return;
    }
    
    // For custom URLs, bypass automation checks
    if (profileId === 'custom') {
      // For custom URLs, the entire URL should be in the taskId field
      if (!taskId) {
        taskValidationMessage.textContent = 'Please enter a URL';
        return;
      }
      
      // Validate URL format
      try {
        new URL(taskId.startsWith('http') ? taskId : `https://${taskId}`);
      } catch (e) {
        taskValidationMessage.textContent = 'Invalid URL format';
        return;
      }
      
      // Add the task with the custom URL
      taskQueue.push({
        profileId: 'custom',
        taskId: '',
        url: taskId.startsWith('http') ? taskId : `https://${taskId}`,
        profileName: 'Custom URL'
      });
    } else {
      // For profile-based tasks, check automation requirements first
      if (!validateAutomationRequirements()) {
        return; // Don't add task if validation fails (error message already shown)
      }
      
      if (!taskId) {
        taskValidationMessage.textContent = 'Please enter a task ID';
        return;
      }
      
      const profile = siteProfiles[profileId];
      if (!profile || !profile.urlPattern) {
        taskValidationMessage.textContent = 'Selected profile is invalid';
        return;
      }
      
      // Get the base URL pattern
      const urlPattern = profile.urlPattern.split(' ')[0]; // Take the first pattern if multiple
      
      // Construct the full URL
      let url;
      if (urlPattern.endsWith('/')) {
        url = `https://${urlPattern}${taskId}`;
      } else {
        url = `https://${urlPattern}/${taskId}`;
      }
      
      // Add to task queue
      taskQueue.push({
        profileId,
        taskId,
        url,
        profileName: profile.name || profileId
      });
    }
    
    // Clear input and validation message
    taskIdInput.value = '';
    taskValidationMessage.textContent = '';
    
    // Update task table
    updateTaskTable();
    
    // Enable/disable buttons
    btnStartTasks.disabled = taskQueue.length === 0 || isProcessingTasks;
    btnClearTasks.disabled = isProcessingTasks;
  }

  function updateTaskTable() {
    // Clear existing rows
    taskTableBody.innerHTML = '';
    
    // Add a row for each task
    taskQueue.forEach((task, index) => {
      const row = document.createElement('tr');
      
      // Highlight current task
      if (isProcessingTasks && index === currentTaskIndex) {
        row.className = 'current-task';
      }
      
      // Sequence number column
      const seqCell = document.createElement('td');
      seqCell.textContent = (index + 1).toString();
      seqCell.className = 'seq-cell';
      row.appendChild(seqCell);
      
      // Profile column
      const profileCell = document.createElement('td');
      profileCell.textContent = task.profileName;
      profileCell.className = 'profile-cell';
      row.appendChild(profileCell);
      
      // Task ID column
      const taskIdCell = document.createElement('td');
      taskIdCell.textContent = task.taskId || '-';
      taskIdCell.className = 'task-id-cell';
      row.appendChild(taskIdCell);
      
      // Info column - show courseInfo for auto-added tasks, URL for manual tasks
      const infoCell = document.createElement('td');
      
      // If this is an auto-added task with courseInfo, use that
      // Otherwise (for manually added tasks), use the URL
      if (task.courseInfo) {
        infoCell.textContent = task.courseInfo;
      } else {
        infoCell.textContent = task.url || '-';
      }
      
      infoCell.className = 'info-cell';
      row.appendChild(infoCell);
      
      // Icon button for removing task
      const actionCell = document.createElement('td');
      actionCell.className = 'action-cell';
      const removeButton = document.createElement('button');
      removeButton.className = 'icon-remove-button';
      removeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" 
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      removeButton.disabled = isProcessingTasks && index === currentTaskIndex;
      removeButton.title = "Remove task";
      removeButton.addEventListener('click', () => removeTask(index));
      actionCell.appendChild(removeButton);
      row.appendChild(actionCell);
      
      taskTableBody.appendChild(row);
    });
  }

  // Helper function to truncate URLs nicely
  function truncateUrl(url, maxLength) {
    if (!url || url.length <= maxLength) return url;
    
    // Try to create a meaningful truncation
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;
      const path = urlObj.pathname;
      
      // If just the domain is too long, truncate it
      if (domain.length > maxLength - 3) {
        return domain.substring(0, maxLength - 3) + '...';
      }
      
      // If domain.com/session/123456, return domain.com/.../123456
      const pathParts = path.split('/').filter(p => p);
      const lastPart = pathParts.length > 0 ? pathParts[pathParts.length - 1] : '';
      
      if (domain.length + lastPart.length + 5 <= maxLength) {
        return `${domain}/.../${lastPart}`;
      }
      
      // If still too long, just truncate the whole URL
      return url.substring(0, maxLength - 3) + '...';
    } catch (e) {
      // If URL parsing fails, do simple truncation
      return url.substring(0, maxLength - 3) + '...';
    }
  }

  function removeTask(index) {
    // Can't remove the current task if it's processing
    if (isProcessingTasks && index === currentTaskIndex) {
      return;
    }
    
    // Remove the task
    taskQueue.splice(index, 1);
    
    // If removing a task before current task, adjust current task index
    if (isProcessingTasks && index < currentTaskIndex) {
      currentTaskIndex--;
    }
    
    // Update UI
    updateTaskTable();
    
    // Update button states
    btnStartTasks.disabled = taskQueue.length === 0 || isProcessingTasks || !validateAutomationRequirements();
  }

  function clearAllTasks() {
    if (isProcessingTasks) {
      taskValidationMessage.textContent = 'Cannot clear tasks while processing';
      return;
    }
    
    taskQueue = [];
    updateTaskTable();
    btnStartTasks.disabled = true;
  }

  resetProgressCheckbox.addEventListener('change', function() {
    resetVideoProgress = this.checked;
    console.log('Reset video progress set to:', resetVideoProgress);
    
    // Save to config file
    saveConfig();
  });

  // Add event listener for fast mode checkbox
  fastModeCheckbox.addEventListener('change', function() {
    fastModeEnabled = this.checked;
    console.log('Fast mode set to:', fastModeEnabled);
    
    // Save to config file
    saveConfig();
  });

  autoMuteCheckbox.addEventListener('change', function() {
    autoMuteEnabled = this.checked;
    console.log('Auto-mute set to:', autoMuteEnabled);
    
    // Save to config file
    saveConfig();
  });

  // Create functions to get the effective values based on fast mode state
  function getEffectiveCheckInterval() {
    // Only apply fast mode to YanHeKT Session tasks, not live streams
    if (isProcessingTasks && fastModeEnabled && 
        taskQueue[currentTaskIndex] && 
        taskQueue[currentTaskIndex].profileId === 'yanhekt_session') {
      console.log('Fast Mode active: Using 0.5s check interval');
      return 0.5; // Fast mode check interval
    }
    const normalInterval = parseFloat(inputCheckInterval.value);
    console.log('Using normal check interval:', normalInterval);
    return normalInterval;
  }

  function getEffectiveAutoAdjustSpeed() {
    // Only apply fast mode to YanHeKT Session tasks, not live streams
    if (isProcessingTasks && fastModeEnabled && 
        taskQueue[currentTaskIndex] && 
        taskQueue[currentTaskIndex].profileId === 'yanhekt_session') {
      console.log('Fast Mode active: Forcing auto-adjust speed ON');
      return true; // Force auto-adjust speed in fast mode
    }
    console.log('Using normal auto-adjust speed setting:', autoAdjustSpeed.checked);
    return autoAdjustSpeed.checked;
  }

  function getEffectiveTargetSpeed() {
    // Only apply fast mode to YanHeKT Session tasks, not live streams
    if (isProcessingTasks && fastModeEnabled && 
        taskQueue[currentTaskIndex] && 
        taskQueue[currentTaskIndex].profileId === 'yanhekt_session') {
      console.log('Fast Mode active: Using 4.0x playback speed');
      return 4.0; // Fast mode speed
    }
    const normalSpeed = parseFloat(playbackSpeed.value);
    console.log('Using normal playback speed:', normalSpeed);
    return normalSpeed;
  }

  // Add a visual indicator for fast mode to the UI
  async function updateFastModeIndicator() {
    // Remove any existing indicator
    const existingIndicator = document.getElementById('fastModeIndicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }
    
    // Add indicator if fast mode is enabled and we're processing a YanHeKT Session task
    if (isProcessingTasks && fastModeEnabled && 
        taskQueue[currentTaskIndex] && 
        taskQueue[currentTaskIndex].profileId === 'yanhekt_session') {
      const indicator = document.createElement('div');
      indicator.id = 'fastModeIndicator';
      indicator.className = 'fast-mode-active';

      updateIndicatorText('fastMode', indicator);
      
      // Insert after title display
      if (titleDisplay.nextSibling) {
        titleDisplay.parentNode.insertBefore(indicator, titleDisplay.nextSibling);
      } else {
        titleDisplay.parentNode.appendChild(indicator);
      }
    }
  }

  // Add CSS for the fast mode indicator
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    .fast-mode-active {
      color: #e74c3c;
      font-weight: bold;
      margin: 5px 0;
      padding: 5px;
      background-color: rgba(231, 76, 60, 0.1);
      border-radius: 4px;
      text-align: center;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }

    .mute-indicator {
      color: #e74c3c;
      background-color: rgba(231, 76, 60, 0.1);
      padding: 5px;
      margin: 5px 0;
      border-radius: 4px;
      text-align: center;
      font-weight: bold;
    }
  `;
  document.head.appendChild(styleSheet);

  // Reset video progress for YanHeKT session
  async function resetYanHeKTSessionProgress(sessionId) {
    try {
      console.log('Resetting progress for session:', sessionId);
      
      if (!sessionId) {
        throw new Error('Session ID is required to reset progress');
      }
      
      // Extract authentication token from localStorage
      const authInfo = await webview.executeJavaScript(`
        (function() {
          // Get auth data from localStorage (this is where YanHeKT stores it)
          let token = null;
          try {
            // First try to get from localStorage (primary method)
            const authData = localStorage.getItem('auth');
            if (authData) {
              const parsed = JSON.parse(authData);
              token = parsed.token;
            }
            
            // If not found, try backup locations
            if (!token) {
              for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                const value = localStorage.getItem(key);
                if (value) {
                  token = value.replace(/^"|"$/g, '');
                  break;
                }
              }
            }
            
            // Last resort: try cookies
            if (!token) {
              const cookies = document.cookie.split(';');
              const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
              if (tokenCookie) {
                token = tokenCookie.split('=')[1].trim();
              }
            }
          } catch (e) {
            console.error('Error extracting token:', e);
          }
          
          // Get user agent for request headers
          const userAgent = navigator.userAgent;
          
          // Generate timestamp for request
          const timestamp = Math.floor(Date.now() / 1000).toString();
          
          return {
            token: token,
            userAgent: userAgent,
            timestamp: timestamp,
            traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
          };
        })();
      `);
      
      if (!authInfo.token) {
        throw new Error('Authentication token not found. Please log in first.');
      }
      
      // Call the reset progress API
      const result = await window.electronAPI.makeApiRequest({
        url: 'https://cbiz.yanhekt.cn/v1/course/session/user/progress',
        method: 'PUT',
        headers: {
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
          'Authorization': `Bearer ${authInfo.token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://www.yanhekt.cn',
          'Referer': 'https://www.yanhekt.cn/',
          'User-Agent': authInfo.userAgent,
          'X-TRACE-ID': authInfo.traceId,
          'Xdomain-Client': 'web_user',
          'xclient-timestamp': authInfo.timestamp,
          'xclient-version': 'v1'
        },
        body: JSON.stringify({
          session_id: sessionId.toString(),
          seconds: 0
        })
      });
      
      console.log('Progress reset result:', result);
      return result;
    } catch (error) {
      console.error('Error resetting session progress:', error);
      throw error;
    }
  }

  // Function to fetch live course listings from YanHeKT API
  async function fetchLiveList(page = 1, pageSize = 16) {
    try {  
      // Extract authentication token from localStorage
      const authInfo = await webview.executeJavaScript(`
        (function() {
          // Get auth data from localStorage (this is where YanHeKT stores it)
          let token = null;
          try {
            // First try to get from localStorage (primary method)
            const authData = localStorage.getItem('auth');
            if (authData) {
              const parsed = JSON.parse(authData);
              token = parsed.token;
              console.log('Found token in localStorage');
            }
            
            // If not found in localStorage, try backup locations
            if (!token) {
              for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                const value = localStorage.getItem(key);
                if (value) {
                  token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                  console.log('Found token in localStorage key:', key);
                  break;
                }
              }
            }
            
            // Last resort: try cookies
            if (!token) {
              const cookies = document.cookie.split(';');
              const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
              if (tokenCookie) {
                token = tokenCookie.split('=')[1].trim();
                console.log('Found token in cookies');
              }
            }
          } catch (e) {
            console.error('Error extracting token:', e);
          }
          
          // Get user agent for request headers
          const userAgent = navigator.userAgent;
          
          // Generate timestamp for request
          const timestamp = Math.floor(Date.now() / 1000).toString();
          
          return {
            token: token,
            userAgent: userAgent,
            timestamp: timestamp,
            traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
          };
        })();
      `);
      
      console.log('Auth info retrieved (token hidden):', {
        ...authInfo,
        token: authInfo.token ? '***token-hidden***' : 'null'
      });
      
      if (!authInfo.token) {
        throw new Error('Authentication token not found. Please log in first and refresh the page.');
      }
      
      // Call the API through main process to avoid CORS issues
      const result = await window.electronAPI.makeApiRequest({
        url: `https://cbiz.yanhekt.cn/v2/live/list?page=${page}&page_size=${pageSize}&user_relationship_type=1`,
        headers: {
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
          'Authorization': `Bearer ${authInfo.token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://www.yanhekt.cn',
          'Referer': 'https://www.yanhekt.cn/',
          'User-Agent': authInfo.userAgent,
          'X-TRACE-ID': authInfo.traceId,
          'Xdomain-Client': 'web_user',
          'xclient-timestamp': authInfo.timestamp,
          'xclient-version': 'v2'
        }
      });
      
      console.log(`API response for live courses page ${page}:`, result);
      
      // Process API response
      if (result.code === 0 && result.data) {
        return result; // Return the raw API response
      } else if (result.code === 401) {
        throw new Error('Authentication failed. Please refresh the page and log in again.');
      } else {
        throw new Error(result.message || 'Failed to fetch live courses data from API');
      }
    } catch (error) {
      console.error('Error fetching live list:', error);
      statusText.textContent = `Error: ${error.message || 'Failed to fetch live courses'}`;
      setTimeout(() => {
        updateStatusConditional(captureInterval, 'capturing', 'idle');
      }, 3000);
      throw error;
    }
  }
  
  // Extract and format live course information from API response
  function parseLiveInfo(apiResponse) {
    try {
      const liveCourses = [];
      
      if (apiResponse?.data?.data && Array.isArray(apiResponse.data.data)) {
        apiResponse.data.data.forEach(live => {
          // Extract the key information
          liveCourses.push({
            liveId: live.id,
            courseId: live.source_id,
            courseName: live.course?.name_zh || live.title,
            title: live.title,
            subtitle: live.subtitle,
            startedAt: live.started_at,
            endedAt: live.ended_at,
            status: live.status, // 1=live, 2=upcoming
            statusText: getStatusText(live.status),
            professorName: live.session?.professor?.name || '',
            location: live.location || '',
            participantCount: live.participant_count || 0
          });
        });
      }
      
      return liveCourses;
    } catch (error) {
      console.error('Error parsing live info:', error);
      return [];
    }
  }
  
  // Helper function to get status text
  function getStatusText(status) {
    switch (status) {
      case 1: return 'Live';
      case 2: return 'upcoming';
      default: return 'Unknown';
    }
  }
  
  // Detect YanHeKT Live Course page and fetch data
  async function detectYanHeKTLiveCourse(url) {
    // Check if we're on the live course page
    if (!url.includes('yanhekt.cn/liveCourse')) {
      return;
    }

    try {
      // Wait longer to ensure the page is fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if we're on a live course page with updated selectors
      const isValidPage = await webview.executeJavaScript(`
        (function() {
          // Log everything to help debug
          console.log('Page URL:', window.location.href);
          
          // Updated live course page check - look for common-course-card instead of live-content
          const hasLiveElements = document.querySelectorAll('.common-course-card').length > 0 || 
                                document.querySelector('.ant-list-grid') !== null;
          
          console.log('Found common-course-cards:', document.querySelectorAll('.common-course-card').length);
          console.log('Found ant-list-grid:', document.querySelector('.ant-list-grid') !== null);
          
          // Get pagination info if available
          const paginationItems = document.querySelectorAll('.ant-pagination-item');
          let currentPage = 1;
          let totalPages = 1;
          
          if (paginationItems.length > 0) {
            paginationItems.forEach(item => {
              if (item.classList.contains('ant-pagination-item-active')) {
                currentPage = parseInt(item.textContent, 10) || 1;
              }
              const pageNum = parseInt(item.textContent, 10) || 0;
              if (pageNum > totalPages) {
                totalPages = pageNum;
              }
            });
          }
          
          return {
            hasLiveElements: hasLiveElements,
            currentPage: currentPage,
            totalPages: totalPages
          };
        })();
      `);
      
      console.log('Live page validation result:', isValidPage);
      
      if (!isValidPage.hasLiveElements) {
        console.log('No live course elements found on page');
        statusText.textContent = 'No live courses found. Please make sure you can see the live courses list';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      // Fetch live courses
      let allLiveCourses = [];
      const currentPage = isValidPage.currentPage || 1;
      const totalPages = isValidPage.totalPages || 1;
      
      // First get the current page
      const apiResponse = await fetchLiveList(currentPage);
      const currentPageLives = parseLiveInfo(apiResponse);
      allLiveCourses = [...currentPageLives];
      
      // Fetch remaining pages (with a reasonable limit)
      const maxPagesToFetch = 3; // Limit to avoid excessive API calls
      const pagesToFetch = Math.min(totalPages, maxPagesToFetch);
      
      if (pagesToFetch > 1) {        
        // Fetch all other pages except the current one
        for (let page = 1; page <= pagesToFetch; page++) {
          if (page !== currentPage) { // Skip the page we already fetched
            try {
              const pageResponse = await fetchLiveList(page);
              const pageLives = parseLiveInfo(pageResponse);
              allLiveCourses = [...allLiveCourses, ...pageLives];
            } catch (pageError) {
              console.error(`Error fetching page ${page}:`, pageError);
            }
          }
        }
      }
      
      if (allLiveCourses.length === 0) {
        console.log('No live courses found');
        statusText.textContent = 'No live courses found';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 2000);
        return;
      }
      
      // Inject buttons to the UI with pagination monitoring
      const injectionResult = await injectYanHeKTLiveButtons(allLiveCourses, currentPage, totalPages);
      console.log('Live button injection result:', injectionResult);
      
      // Show status message
      updateStatus('liveFound', { 
        count: allLiveCourses.length, 
        pages: totalPages, 
      }, 3000);
      
    } catch (error) {
      console.error('Failed to fetch or parse live courses:', error);
      statusText.textContent = `Error: ${error.message || 'Failed to analyze live courses'}`;
      setTimeout(() => {
        updateStatusConditional(captureInterval, 'capturing', 'idle');
      }, 3000);
    }
  }
  
  function injectYanHeKTLiveButtons(liveCourses, currentPage, totalPages) {
    return webview.executeJavaScript(`
      (function() {
        try {
          // Store the live courses data passed from the parent scope
          const liveCourses = ${JSON.stringify(liveCourses)};
          
          console.log('Starting live button injection for', liveCourses.length, 'courses across', ${totalPages}, 'pages');
          
          // Store live course data for all pages - use the local variable we just created
          window.__autoSlidesLiveCourses = liveCourses;
          window.__currentLivePage = ${currentPage};
          window.__totalLivePages = ${totalPages};
          
          // CLEANUP: Remove all existing buttons and notes
          document.querySelectorAll('.autoslides-live-btn').forEach(button => {
            button.remove();
          });
          
          // Remove "Add All" button and pagination note
          document.querySelectorAll('.autoslides-live-btn-all, .autoslides-live-pagination-note').forEach(el => {
            el.remove();
          });
          
          // Add CSS styles for our buttons
          const style = document.createElement('style');
          style.textContent = \`
              .autoslides-live-btn {
                background-color: #52c41a !important;
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                margin-top: 8px;
                width: 100%;
                text-align: center;
              }
              .autoslides-live-btn:hover {
                opacity: 0.9;
              }
              .autoslides-live-btn-all {
                background-color: #52c41a;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 20px;
                margin: 20px auto;
                cursor: pointer;
                display: block;
              }
              .autoslides-live-btn-all:hover {
                opacity: 0.9;
              }
              .autoslides-live-pagination-note {
                color: #1890ff;
                font-size: 14px;
                margin-left: 15px;
                display: inline-block;
                vertical-align: middle;
              }
            \`;
          
          // Only add stylesheet if it doesn't exist
          if (!document.querySelector('style[data-autoslides-live-style]')) {
            style.setAttribute('data-autoslides-live-style', 'true');
            document.head.appendChild(style);
          }
          
          // Find all live course cards
          const liveCards = document.querySelectorAll('.common-course-card');
          console.log('Found', liveCards.length, 'live cards on page', ${currentPage});
          
          if (!liveCards.length) {
            console.error('No live cards found in DOM');
            return { success: false, message: 'No live cards found' };
          }
          
          // Add pagination monitoring
          const setupPaginationMonitoring = function() {
            // Monitor pagination elements
            const paginationItems = document.querySelectorAll('.ant-pagination-item, .ant-pagination-prev, .ant-pagination-next');
            paginationItems.forEach(item => {
              // Avoid adding multiple listeners to the same element
              if (!item.dataset.autoSlidesLiveMonitored) {
                item.dataset.autoSlidesLiveMonitored = 'true';
                
                item.addEventListener('click', function() {
                  console.log('AUTOSLIDES_LIVE_PAGINATION_CLICKED');
                  // Wait for the page to update
                  setTimeout(() => {
                    // Get updated current page
                    const activePage = document.querySelector('.ant-pagination-item-active');
                    if (activePage) {
                      const newPage = parseInt(activePage.textContent, 10) || 1;
                      console.log('AUTOSLIDES_LIVE_PAGE_CHANGED:' + newPage);
                    }
                  }, 500);
                });
              }
            });
            
            // Also monitor the jump box
            const jumpBox = document.querySelector('.ant-pagination-options-quick-jumper input');
            if (jumpBox && !jumpBox.dataset.autoSlidesLiveMonitored) {
              jumpBox.dataset.autoSlidesLiveMonitored = 'true';
              jumpBox.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                  console.log('AUTOSLIDES_LIVE_PAGINATION_JUMPED');
                  // Wait for the page to update
                  setTimeout(() => {
                    const activePage = document.querySelector('.ant-pagination-item-active');
                    if (activePage) {
                      const newPage = parseInt(activePage.textContent, 10) || 1;
                      console.log('AUTOSLIDES_LIVE_PAGE_CHANGED:' + newPage);
                    }
                  }, 500);
                }
              });
            }
            
            // Add the pagination information text to the pagination control
            if (${totalPages} > 1) {
              // First remove any existing pagination note we previously added
              const existingNote = document.querySelector('.autoslides-live-pagination-note');
              if (existingNote) {
                existingNote.remove();
              }
              
              // Find the jumper container
              const paginationJumper = document.querySelector('.ant-pagination-options-quick-jumper');
              if (paginationJumper) {
                // Create the pagination note
                const paginationNote = document.createElement('span');
                paginationNote.className = 'autoslides-live-pagination-note';
                paginationNote.innerHTML = \`All ${totalPages} pages of live courses loaded, \${liveCourses.length} courses total\`;
                
                // Insert after the jumper
                if (paginationJumper.parentNode) {
                  paginationJumper.insertAdjacentElement('afterend', paginationNote);
                }
              }
            }
          };
          
          // Call immediately to set up monitoring
          setupPaginationMonitoring();
          
          // Also refresh pagination monitoring occasionally in case the DOM changes
          setInterval(setupPaginationMonitoring, 2000);
          
          // Loop through live cards and inject buttons
          let buttonCount = 0;
          
          liveCards.forEach((card, index) => {
            // We need to associate each card with a live course from our data
            // Without a clear ID in the DOM, we'll use the title and time to match
            const titleElem = card.querySelector('.line-1');
            const professorElem = card.querySelector('.line-2');
            const timeElem = card.querySelector('.living-tag');
            
            if (!titleElem || !titleElem.textContent) {
              console.log('Missing title for card', index);
              return;
            }
            
            // Extract course info from the card
            const courseTitle = titleElem.textContent.trim();
            const professorName = professorElem ? professorElem.textContent.trim() : '';
            const timeText = timeElem ? timeElem.textContent.trim() : '';
            
            // Try to find matching live course
            let matchingLive = null;
            let liveId = null;
            
            // First try to get from our pre-loaded data by index if available
            if (index < liveCourses.length) {
              matchingLive = liveCourses[index];
              liveId = matchingLive.liveId;
            }
            
            // If no match by index or missing ID, try matching by title
            if (!liveId) {
              matchingLive = liveCourses.find(l => 
                l.title === courseTitle || 
                l.courseName === courseTitle
              );
              
              if (matchingLive) {
                liveId = matchingLive.liveId;
              }
            }
            
            // If still no match, try matching by professor and time
            if (!liveId && professorName && timeText) {
              matchingLive = liveCourses.find(l => 
                (l.professorName && l.professorName.includes(professorName)) && 
                (l.startedAt && timeText.includes(l.startedAt.substring(0, 16)))
              );
              
              if (matchingLive) {
                liveId = matchingLive.liveId;
              }
            }
            
            if (!liveId) {
              console.log('Could not find live ID for card', index, 'with title', courseTitle);
              return;
            }
            
            // Find the info div to add our button
            const infoDiv = card.querySelector('.info');
            
            if (infoDiv) {
              // Create button
              const button = document.createElement('button');
              button.className = 'autoslides-live-btn';
              button.innerText = 'Add to Tasks';
              button.setAttribute('data-live-id', liveId);
              button.setAttribute('data-index', index);
              
              // Add onclick handler that uses console.log
              button.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Find the actual live course in our data
                const liveCourse = window.__autoSlidesLiveCourses.find(l => l.liveId.toString() === liveId.toString());
                
                // Special prefix that we'll detect in the console-message event
                console.log('AUTOSLIDES_ADD_LIVE:' + JSON.stringify({
                  liveId: liveId,
                  liveCourse: liveCourse || { liveId: liveId }
                }));
                
                return false; // Prevent default
              };
              
              // Append to the info div
              infoDiv.appendChild(button);
              buttonCount++;
            } else {
              console.log('No info div found for card', index);
            }
          });
          
          // Add "Add All" button at the bottom of the page
          const liveContent = document.querySelector('.ant-row');
          if (liveContent) {
            // Create container for the "Add All" button
            const buttonContainer = document.createElement('div');
            buttonContainer.style.textAlign = 'center';
            buttonContainer.style.margin = '20px 0';
            buttonContainer.style.width = '100%';
            
            const addAllButton = document.createElement('button');
            addAllButton.className = 'autoslides-live-btn-all';
            addAllButton.innerHTML = 'Add All Live Courses to Task List';
            
            // Use console.log approach for add all button too
            addAllButton.onclick = function() {
              console.log('AUTOSLIDES_ADD_ALL_LIVES');
              return false; // Prevent default
            };
            
            buttonContainer.appendChild(addAllButton);
            liveContent.parentNode.insertBefore(buttonContainer, liveContent.nextSibling);
            console.log('Added "Add All" button for live courses');
          } else {
            console.log('No live container found for "Add All" button');
          }
          
          console.log('Successfully added', buttonCount, 'live buttons');
          return { success: true, buttonCount, message: 'Live button injection complete' };
        } catch (error) {
          console.error('Error injecting live buttons:', error);
          return { success: false, error: error.toString() };
        }
      })();
    `);
  }

  // Add a single YanHeKT live course to task queue
  async function addYanHeKTLiveToTasks(liveId, liveCourseData) {
    try {
      console.log('Adding YanHeKT live course to tasks:', liveId, 'with data:', liveCourseData);
      
      if (!liveId) {
        console.error('Live ID not provided');
        statusText.textContent = 'Error: Live course ID not found';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      const yanHeKTLiveProfileId = 'yanhekt_live';
      if (!siteProfiles[yanHeKTLiveProfileId]) {
        console.error('YanHeKT Live profile not found in siteProfiles:', yanHeKTLiveProfileId);
        statusText.textContent = 'Error: YanHeKT Live profile not found';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      // Check if this live course is already in the task queue
      const existingTask = taskQueue.find(task => 
        task.profileId === yanHeKTLiveProfileId && 
        task.taskId === liveId.toString()
      );
      
      if (existingTask) {
        return;
      }
      
      // Get course information for the Info column
      let courseInfo = '';
      
      // For live courses, we can extract info directly from the liveCourseData
      if (liveCourseData) {
        if (liveCourseData.title) {
          courseInfo = liveCourseData.title;
        } else if (liveCourseData.courseName) {
          courseInfo = liveCourseData.courseName;
        }
      }
      
      // Use a default if we don't have course info
      if (!courseInfo) {
        courseInfo = 'Live Course ' + liveId;
      }
      
      console.log('Using profile:', yanHeKTLiveProfileId, 'for live course:', liveId);

      // Add to task queue
      taskQueue.push({
        profileId: yanHeKTLiveProfileId,
        taskId: liveId.toString(),
        url: `https://www.yanhekt.cn/live/${liveId}`,
        profileName: siteProfiles[yanHeKTLiveProfileId].name || yanHeKTLiveProfileId,
        courseInfo: courseInfo // Add the course info to the task
      });
      
      console.log('Task queue updated:', taskQueue.length, 'tasks');
      
      // Update UI
      updateTaskTable();
      btnStartTasks.disabled = taskQueue.length === 0 || isProcessingTasks || !validateAutomationRequirements();
      
      // Open task manager
      if (taskManagerModal.style.display !== 'block') {
        openTaskManager();
      }
      
      updateStatus('liveAdd', {}, 3000);
      
    } catch (error) {
      console.error('Error adding YanHeKT live course to tasks:', error);
      statusText.textContent = `Error: ${error.message}`;
      setTimeout(() => {
        updateStatusConditional(captureInterval, 'capturing', 'idle');
      }, 3000);
    }
  }

  // Add all YanHeKT live courses to task queue
  async function addAllYanHeKTLivesToTasks() {
    try {
      console.log('Adding all YanHeKT live courses to tasks');
      
      const liveCourses = await webview.executeJavaScript('window.__autoSlidesLiveCourses');
      if (!liveCourses || !liveCourses.length) {
        console.error('No live courses found');
        statusText.textContent = 'No live courses found to add';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      const yanHeKTLiveProfileId = 'yanhekt_live';
      if (!siteProfiles[yanHeKTLiveProfileId]) {
        console.error('YanHeKT Live profile not found in siteProfiles:', yanHeKTLiveProfileId);
        statusText.textContent = 'Error: YanHeKT Live profile not found';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      // Get a count of how many courses we'll add (exclude those already in the queue)
      const existingLiveIds = taskQueue
        .filter(task => task.profileId === yanHeKTLiveProfileId)
        .map(task => task.taskId);
      
      const newLiveCourses = liveCourses.filter(lc => 
        !existingLiveIds.includes(lc.liveId.toString())
      );
      
      if (newLiveCourses.length === 0) {
        return;
      }
      
      console.log('Using profile:', yanHeKTLiveProfileId, 'for', newLiveCourses.length, 'live courses');
      
      // Add confirmation for large number of courses
      if (newLiveCourses.length > 16) {
        const confirmResult = await webview.executeJavaScript(`
          confirm('Are you sure you want to add ${newLiveCourses.length} live courses to the task queue?')
        `);
        
        if (!confirmResult) {
          statusText.textContent = 'Bulk live course addition cancelled';
          setTimeout(() => {
            updateStatusConditional(captureInterval, 'capturing', 'idle');
          }, 3000);
          return;
        }
      }
      
      // Add all new live courses to task queue
      for (const liveCourse of newLiveCourses) {
        // Get course information for the Info column
        let courseInfo = '';
        if (liveCourse.title) {
          courseInfo = liveCourse.title;
        } else if (liveCourse.courseName) {
          courseInfo = liveCourse.courseName;
        } else {
          courseInfo = 'Live Course ' + liveCourse.liveId;
        }
        
        taskQueue.push({
          profileId: yanHeKTLiveProfileId,
          taskId: liveCourse.liveId.toString(),
          url: `https://www.yanhekt.cn/live/${liveCourse.liveId}`,
          profileName: siteProfiles[yanHeKTLiveProfileId].name || yanHeKTLiveProfileId,
          courseInfo: courseInfo
        });
      }
      
      console.log('Task queue updated:', taskQueue.length, 'tasks');
      
      // Update UI
      updateTaskTable();
      btnStartTasks.disabled = taskQueue.length === 0 || isProcessingTasks || !validateAutomationRequirements();
      
      // Open task manager
      if (taskManagerModal.style.display !== 'block') {
        openTaskManager();
      }
      
      updateStatus('allLiveAdd', { count: newLiveCourses.length }, 3000);
      
    } catch (error) {
      console.error('Error adding YanHeKT live courses to tasks:', error);
      statusText.textContent = `Error: ${error.message}`;
      setTimeout(() => {
        updateStatusConditional(captureInterval, 'capturing', 'idle');
      }, 3000);
    }
  }

  async function startTaskProcessing() {
    // For starting tasks, we need to verify that all profile-based tasks have valid profiles
    let allTasksValid = true;
    let invalidTaskIndex = -1;
    
    // Validate all non-custom tasks
    for (let i = 0; i < taskQueue.length; i++) {
      const task = taskQueue[i];
      if (task.profileId !== 'custom') {
        const profile = siteProfiles[task.profileId];
        
        if (!profile) {
          allTasksValid = false;
          invalidTaskIndex = i;
          break;
        }
        
        const automation = profile.automation || {};
        if (!automation.autoDetectEnd || !automation.autoStartPlayback || !automation.autoDetectTitle) {
          allTasksValid = false;
          invalidTaskIndex = i;
          break;
        }
      }
    }
    
    if (!allTasksValid) {
      const invalidTask = taskQueue[invalidTaskIndex];
      taskValidationMessage.textContent = `Task #${invalidTaskIndex + 1} (${invalidTask.profileName}) has invalid automation settings`;
      return;
    }
    
    if (taskQueue.length === 0 || isProcessingTasks) {
      return;
    }
    
    isProcessingTasks = true;
    currentTaskIndex = 0;

    // Update the fast mode indicator
    updateFastModeIndicator();
    
    // Update UI
    updateTaskTable();
    btnStartTasks.disabled = true;
    btnCancelTasks.disabled = false;
    btnClearTasks.disabled = true;
    
    // Add task progress indicator to status area
    const taskProgress = document.createElement('div');
    taskProgress.id = 'taskProgressIndicator';
    taskProgress.className = 'task-progress';

    updateIndicatorText('taskProgress', taskProgress, {
      current: 1,
      total: taskQueue.length
    });
    
    // Insert after title display or fast mode indicator
    const fastModeIndicator = document.getElementById('fastModeIndicator');
    if (fastModeIndicator) {
      fastModeIndicator.parentNode.insertBefore(taskProgress, fastModeIndicator.nextSibling);
    } else if (titleDisplay.nextSibling) {
      titleDisplay.parentNode.insertBefore(taskProgress, titleDisplay.nextSibling);
    } else {
      titleDisplay.parentNode.appendChild(taskProgress);
    }
    
    // Process the first task
    await processNextTask();
  }

  function cancelTaskProcessing() {
    if (!isProcessingTasks) return;
    
    isProcessingTasks = false;
    
    // Stop the current capture if running
    if (captureInterval) {
      stopCapture();
    }
  
    // Unmute the webview audio if auto-mute is enabled
    if (autoMuteEnabled) {
      window.electronAPI.unmuteWebviewAudio(webview.id)
        .then(result => console.log('Task cancellation unmute result:', result))
        .catch(err => console.error('Error unmuting during task cancellation:', err));
      
      const muteIndicator = document.getElementById('muteIndicator');
      if (muteIndicator) {
        muteIndicator.remove();
      }
    }
    
    // Reset state
    currentTaskIndex = -1;
  
    // Remove fast mode indicator
    const fastModeIndicator = document.getElementById('fastModeIndicator');
    if (fastModeIndicator) fastModeIndicator.remove();
    
    // Update UI
    btnStartTasks.disabled = !validateAutomationRequirements();
    btnCancelTasks.disabled = true;
    btnClearTasks.disabled = false;
    updateTaskTable();
    
    // Remove task progress indicator
    const taskProgress = document.getElementById('taskProgressIndicator');
    if (taskProgress) taskProgress.remove();
    
    // Navigate to YanHeKT home page
    setTimeout(() => {
      const homeUrl = "https://www.yanhekt.cn/home";
      console.log('Navigating to YanHeKT home page:', homeUrl);
      
      // Use safeLoadURL for proper URL validation and loading
      safeLoadURL(homeUrl);
      
      // Update input field with the URL
      inputUrl.value = homeUrl;
      
      // Update status text
      setTimeout(() => {
        updateStatus('idle');
      }, 2000);
    }, 500);
  }

  async function processNextTask() {
    if (!isProcessingTasks || currentTaskIndex >= taskQueue.length) {
      finishTaskProcessing();
      return;
    }

    const currentTask = taskQueue[currentTaskIndex];

    if (currentTask) {
      // Get the total number of tasks consistent with the status bar display
      const taskProgress = document.getElementById('taskProgressIndicator');
      let totalTasks;
      
      if (taskProgress && taskProgress.dataset.originalCount) {
        totalTasks = parseInt(taskProgress.dataset.originalCount);
      } else {
        // If a progress indicator has not been created yet, use the current queue length as the total.
        totalTasks = taskQueue.length;
      }
      
      const currentTaskNumber = currentTaskIndex + 1;
      
      sendTaskNotification(
        'Task in progress', 
        `AutoSlides is working on task ${currentTaskNumber}/${totalTasks}`
      );
    }

    // Mute the webview audio if auto-mute is enabled
    if (autoMuteEnabled) {
      try {
        const result = await window.electronAPI.muteWebviewAudio(webview.id);
        console.log('Auto-mute result:', result);
        
        if (result.success) {
          console.log('Webview audio muted successfully');
          
          // First remove any existing mute indicator
          const existingMuteIndicator = document.getElementById('muteIndicator');
          if (existingMuteIndicator) {
            existingMuteIndicator.remove();
          }
          
          // Create new mute indicator
          const muteIndicator = document.createElement('div');
          muteIndicator.id = 'muteIndicator';
          muteIndicator.className = 'mute-indicator';
          
          updateIndicatorText('muteAudio', muteIndicator);
          
          // Find insertion point - after fast mode indicator if it exists
          const fastModeIndicator = document.getElementById('fastModeIndicator');
          const statusPanel = titleDisplay.parentNode;
          
          if (fastModeIndicator && fastModeIndicator.parentNode === statusPanel) {
            // Insert after fast mode indicator
            if (fastModeIndicator.nextSibling) {
              statusPanel.insertBefore(muteIndicator, fastModeIndicator.nextSibling);
            } else {
              statusPanel.appendChild(muteIndicator);
            }
          } else {
            if (titleDisplay.nextSibling) {
              statusPanel.insertBefore(muteIndicator, titleDisplay.nextSibling);
            } else {
              statusPanel.appendChild(muteIndicator);
            }
          }
        } else {
          console.warn('Failed to mute webview audio:', result.error || result.message);
        }
      } catch (muteError) {
        console.error('Error applying auto-mute:', muteError);
      }
    }
    
    // Update UI to show current task
    updateTaskTable();
    
    // Update progress indicator
    const taskProgress = document.getElementById('taskProgressIndicator');
    if (taskProgress) {
      // Store the original task count in a data attribute if not already set
      if (!taskProgress.dataset.originalCount) {
        taskProgress.dataset.originalCount = taskQueue.length;
      }
      
      // Use the original count for display
      const originalCount = parseInt(taskProgress.dataset.originalCount);
      // Show completed count (currentTaskIndex) out of total original count
      updateIndicatorText('taskProgress', taskProgress, {
        current: currentTaskIndex + 1,
        total: originalCount
      });
    }
    
    try {
      // Reset important flags for the new task
      speedAdjusted = false;
      speedAdjustRetryAttempts = 0;
      playbackRetryAttempts = 0;
      
      // Clear ALL intervals to ensure clean state
      if (speedAdjustInterval) {
        clearInterval(speedAdjustInterval);
        speedAdjustInterval = null;
      }
      
      if (autoStartCheckInterval) {
        clearInterval(autoStartCheckInterval);
        autoStartCheckInterval = null;
      }
      
      if (captureInterval) {
        clearInterval(captureInterval);
        captureInterval = null;
      }

      // Reset additional capture state
      lastImageData = null;
      verificationState = 'none';
      potentialNewImageData = null;
      verificationMethod = null;
      
      // Switch to the task's profile if needed
      if (currentTask.profileId !== 'custom' && currentTask.profileId !== activeProfileId) {
        siteProfileSelect.value = currentTask.profileId;
        activeProfileId = currentTask.profileId;
        loadProfileDetails(currentTask.profileId);
      }
      
      // For YanHeKT sessions, reset the progress first if the option is enabled
      if (currentTask.profileId === 'yanhekt_session' && resetVideoProgress) {
        try {
          // Extract the session ID from the URL
          const urlMatch = currentTask.url.match(/\/session\/(\d+)/);
          const sessionId = urlMatch ? urlMatch[1] : null;
          
          if (sessionId) {
            await resetYanHeKTSessionProgress(sessionId);
            updateStatus('progressReset');
          }
        } catch (resetError) {
          console.error('Error resetting session progress:', resetError);
          // Continue anyway - failing to reset progress shouldn't stop the task
        }
      }
      
      // Show Fast Mode status message for Live tasks
      if (fastModeEnabled && currentTask.profileId === 'yanhekt_live') {
        console.log('Fast Mode skipped for live task - not applicable to live streams');
        const taskNote = document.createElement('div');
        taskNote.id = 'fastModeSkippedNote';
        taskNote.style.color = '#f39c12';
        taskNote.style.fontSize = '12px';
        taskNote.style.marginTop = '5px';
        
        updateIndicatorText('fastModeSkipped', taskNote);
        
        // Only add if not already present
        if (!document.getElementById('fastModeSkippedNote')) {
          const taskIndicator = document.getElementById('taskProgressIndicator');
          if (taskIndicator && taskIndicator.parentNode) {
            taskIndicator.parentNode.insertBefore(taskNote, taskIndicator.nextSibling);
            
            // Remove this note after 5 seconds
            setTimeout(() => {
              const note = document.getElementById('fastModeSkippedNote');
              if (note) note.remove();
            }, 5000);
          }
        }
      }
  
      // Update fast mode indicator - do this for each task
      updateFastModeIndicator();
      
      // Load the URL
      webview.src = currentTask.url;
      inputUrl.value = currentTask.url;
      
    } catch (error) {
      console.error('Error processing task:', error);
      statusText.textContent = `Error processing task: ${error.message}`;
      
      // Move to next task after a delay
      setTimeout(() => {
        currentTaskIndex++;
        processNextTask();
      }, 2000);
    }
  }

  function finishTaskProcessing() {
    // If there's still a task in the queue and we're done processing, remove it
    if (taskQueue.length > 0 && currentTaskIndex >= 0 && currentTaskIndex < taskQueue.length) {
      taskQueue.splice(currentTaskIndex, 1);
    }

    isProcessingTasks = false;
    currentTaskIndex = -1;

    // Remove fast mode indicator
    const fastModeIndicator = document.getElementById('fastModeIndicator');
    if (fastModeIndicator) fastModeIndicator.remove();
    
    // Update UI
    btnStartTasks.disabled = !validateAutomationRequirements();
    btnCancelTasks.disabled = true;
    btnClearTasks.disabled = false;
    updateTaskTable();
    
    // Remove task progress indicator
    const taskProgress = document.getElementById('taskProgressIndicator');
    if (taskProgress) taskProgress.remove();

    sendTaskNotification('AutoSlides Task Queue Complete', 'All tasks have been processed successfully.', true);

    setTimeout(() => {
      updateStatus('idle');
    }, 2000);
  }
  
  function sendTaskNotification(title, body, isTaskQueue = false) {
    // Use Electron's API to send notifications through IPC
    window.electronAPI.showNotification({
      title: title,
      body: body,
      // Pass whether this is for a task queue or individual task
      isTaskQueue: isTaskQueue 
    });
  }

  // Extract course ID from URL
  function extractCourseId(url) {
    try {
      // Match patterns like /course/55952 or /course/55952/
      const coursePattern = /\/course\/(\d+)(?:\/|$)/;
      const match = url.match(coursePattern);
      
      if (match && match[1]) {
        return match[1];
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting course ID:', error);
      return null;
    }
  }

  // Enhanced fetchSessionList function with pagination support
  async function fetchSessionList(courseId, page = 1, pageSize = 10) {
    try {
      // Basic validation
      if (!courseId) {
        throw new Error('Course ID is required');
      }
      
      // Extract authentication token from localStorage instead of cookies
      const authInfo = await webview.executeJavaScript(`
        (function() {
          // Get auth data from localStorage (this is where YanHeKT stores it)
          let token = null;
          try {
            // First try to get from localStorage (primary method)
            const authData = localStorage.getItem('auth');
            if (authData) {
              const parsed = JSON.parse(authData);
              token = parsed.token;
              console.log('Found token in localStorage');
            }
            
            // If not found in localStorage, try backup locations
            if (!token) {
              // Check alternative localStorage keys
              for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                const value = localStorage.getItem(key);
                if (value) {
                  token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                  console.log('Found token in localStorage key:', key);
                  break;
                }
              }
            }
            
            // Last resort: try cookies
            if (!token) {
              const cookies = document.cookie.split(';');
              const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
              if (tokenCookie) {
                token = tokenCookie.split('=')[1].trim();
                console.log('Found token in cookies');
              }
            }
          } catch (e) {
            console.error('Error extracting token:', e);
          }
          
          // Get user agent for request headers
          const userAgent = navigator.userAgent;
          
          // Generate timestamp for request
          const timestamp = Math.floor(Date.now() / 1000).toString();
          
          // Return all the necessary auth information
          return {
            token: token,
            userAgent: userAgent,
            timestamp: timestamp,
            traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
          };
        })();
      `);
      
      console.log('Auth info retrieved (token hidden):', {
        ...authInfo,
        token: authInfo.token ? '***token-hidden***' : 'null'
      });
      
      if (!authInfo.token) {
        throw new Error('Authentication token not found. Please log in first and refresh the page.');
      }
      
      // Use version 2 of the API for better compatibility
      const apiUrl = `https://cbiz.yanhekt.cn/v2/course/session/list?course_id=${courseId}&with_page=true&page=${page}&page_size=${pageSize}&order_type=desc&order_type_weight=desc`;
      
      // Call the API through our main process to avoid CORS issues
      const result = await window.electronAPI.makeApiRequest({
        url: apiUrl,
        headers: {
          'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
          'Authorization': `Bearer ${authInfo.token}`,
          'Content-Type': 'application/json',
          'Origin': 'https://www.yanhekt.cn',
          'Referer': 'https://www.yanhekt.cn/',
          'User-Agent': authInfo.userAgent,
          'X-TRACE-ID': authInfo.traceId,
          'Xdomain-Client': 'web_user',
          'xclient-timestamp': authInfo.timestamp,
          'xclient-version': 'v2'
        }
      });
      
      console.log(`API response for page ${page}:`, result);
      
      // Process API response
      if (result.code === 0 && result.data) {
        return result; // Return the raw API response
      } else if (result.code === 401) {
        throw new Error('Authentication failed. Please refresh the page and log in again.');
      } else {
        throw new Error(result.message || 'Failed to fetch session data from API');
      }
    } catch (error) {
      console.error('Error fetching session list:', error);
      statusText.textContent = `Error: ${error.message || 'Failed to fetch sessions'}`;
      setTimeout(() => {
        updateStatusConditional(captureInterval, 'capturing', 'idle');
      }, 3000);
      throw error;
    }
  }

  // Extract and format session information from API response
  function parseSessionInfo(apiResponse) {
    try {
      const sessions = [];
      
      if (apiResponse?.data?.data && Array.isArray(apiResponse.data.data)) {
        apiResponse.data.data.forEach(session => {
          // Extract the key information
          sessions.push({
            sessionId: session.id,
            courseId: session.course_id,
            title: session.title,
            weekNumber: session.week_number,
            dayOfWeek: session.day, // 1=Monday, 7=Sunday
            startedAt: session.started_at,
            videoId: session.video_ids?.[0] || null,
            videoUrl: session.videos?.[0]?.main || null,
            // Calculate progress percentage if available
            progressPercent: session.user_progress ? 
              Math.round((parseInt(session.user_progress.progress_current, 10) / 
                         parseInt(session.user_progress.progress_overall, 10)) * 100) : 0
          });
        });
      }
      
      return sessions;
    } catch (error) {
      console.error('Error parsing session info:', error);
      return [];
    }
  }

  // Enhanced detectYanHeKTCourse function with pagination support
  async function detectYanHeKTCourse(url) {
    // Extract course ID
    const courseId = extractCourseId(url);
    if (!courseId) {
      console.log('No valid course ID found in URL');
      return;
    }
    
    try {
      // Wait longer to ensure the page is fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if we're on a course page with session lists
      const isValidPage = await webview.executeJavaScript(`
        (function() {
          // Log everything to help debug
          console.log('Page URL:', window.location.href);
          console.log('Found ant-list-items:', document.querySelectorAll('.ant-list-items').length);
          
          // Course page check without login requirement
          const hasList = document.querySelector('.ant-list-items') !== null;
          const courseHeader = document.querySelector('.ant-breadcrumb') || 
                              document.querySelector('.course-title') || 
                              document.querySelector('h1');
          
          // Get pagination info if available
          const paginationItems = document.querySelectorAll('.ant-pagination-item');
          let currentPage = 1;
          let totalPages = 1;
          
          if (paginationItems.length > 0) {
            paginationItems.forEach(item => {
              if (item.classList.contains('ant-pagination-item-active')) {
                currentPage = parseInt(item.textContent, 10) || 1;
              }
              const pageNum = parseInt(item.textContent, 10) || 0;
              if (pageNum > totalPages) {
                totalPages = pageNum;
              }
            });
          }
          
          return {
            hasList: hasList,
            hasHeader: courseHeader !== null,
            headerText: courseHeader ? courseHeader.textContent : 'Not found',
            currentPage: currentPage,
            totalPages: totalPages
          };
        })();
      `);
      
      console.log('Page validation result:', isValidPage);
      
      if (!isValidPage.hasList) {
        console.log('No session list found on page');
        statusText.textContent = 'No session list found. Please make sure you can see the video sessions';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      // Fetch all pages of sessions
      let allSessions = [];
      const currentPage = isValidPage.currentPage || 1;
      const totalPages = isValidPage.totalPages || 1;
      
      // First get the current page
      const apiResponse = await fetchSessionList(courseId, currentPage);
      const currentPageSessions = parseSessionInfo(apiResponse);
      allSessions = [...currentPageSessions];
      
      // Fetch remaining pages (but don't fetch too many to avoid rate limits)
      const maxPagesToFetch = 5; // Limit to avoid excessive API calls
      const pagesToFetch = Math.min(totalPages, maxPagesToFetch);
      
      if (pagesToFetch > 1) {       
        // Fetch all other pages except the current one
        for (let page = 1; page <= pagesToFetch; page++) {
          if (page !== currentPage) { // Skip the page we already fetched
            try {
              const pageResponse = await fetchSessionList(courseId, page);
              const pageSessions = parseSessionInfo(pageResponse);
              allSessions = [...allSessions, ...pageSessions];
            } catch (pageError) {
              console.error(`Error fetching page ${page}:`, pageError);
            }
          }
        }
      }
      
      if (allSessions.length === 0) {
        console.log('No sessions found for this course');
        statusText.textContent = 'No sessions found';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 2000);
        return;
      }
      
      // Inject buttons to the UI with pagination monitoring
      const injectionResult = await injectYanHeKTButtons(allSessions, courseId, currentPage, totalPages);
      console.log('Button injection result:', injectionResult);
      
      // Show status message
      updateStatus('sessionsFound', { 
        count: allSessions.length, 
        pages: totalPages, 
        courseId: courseId 
      }, 3000);
      
    } catch (error) {
      console.error('Failed to fetch or parse sessions:', error);
      statusText.textContent = `Error: ${error.message || 'Failed to analyze course'}`;
      setTimeout(() => {
        updateStatusConditional(captureInterval, 'capturing', 'idle');
      }, 3000);
    }
  }

  // Improved button injection with proper cleanup for pagination
  function injectYanHeKTButtons(sessions, courseId, currentPage, totalPages) {
    return webview.executeJavaScript(`
      (function() {
        try {
          console.log('Starting button injection for', ${JSON.stringify(sessions).length}, 'sessions across', ${totalPages}, 'pages');
          
          // Store session data for all pages
          window.__autoSlidesSessions = ${JSON.stringify(sessions)};
          window.__courseId = "${courseId}";
          window.__currentPage = ${currentPage};
          window.__totalPages = ${totalPages};
          
          // CLEANUP: Remove all existing buttons and notes
          document.querySelectorAll('.autoslides-btn').forEach(button => {
            // Get the parent li element and remove it
            const li = button.closest('li');
            if (li) li.remove();
          });
          
          // Remove "Add All" button and pagination note
          document.querySelectorAll('.autoslides-btn-all, .autoslides-pagination-note').forEach(el => {
            el.remove();
          });
          
          // Add CSS styles for our buttons
          const style = document.createElement('style');
          style.textContent = \`
            .autoslides-btn {
              background-color: #52c41a !important;
              margin-right: 8px;
            }
            .autoslides-btn-all {
              background-color: #52c41a;
              color: white;
              border: none;
              padding: 8px 16px;
              font-size: 14px;
              border-radius: 20px;
              margin: 10px;
              cursor: pointer;
            }
            .autoslides-btn-all:hover {
              opacity: 0.9;
            }
            .autoslides-pagination-note {
              color: #1890ff;
              font-size: 14px;
              margin: 10px auto;
              padding: 8px;
              background-color: #f0f5ff;
              border-radius: 4px;
              display: inline-block;
            }
            .autoslides-controls-container {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 10px 0;
            width: 100%;
          }
          \`;
          
          // Only add stylesheet if it doesn't exist
          if (!document.querySelector('style[data-autoslides-style]')) {
            style.setAttribute('data-autoslides-style', 'true');
            document.head.appendChild(style);
          }
          
          // Get all list items that contain session information for the current page
          const listItems = document.querySelectorAll('.ant-list-items .ant-list-item');
          console.log('Found', listItems.length, 'list items on page', ${currentPage});
          
          if (!listItems.length) {
            console.error('No session list items found in DOM');
            return { success: false, message: 'No session list items found' };
          }
          
          // Add pagination monitoring
          const setupPaginationMonitoring = function() {
            // Monitor pagination elements
            const paginationItems = document.querySelectorAll('.ant-pagination-item, .ant-pagination-prev, .ant-pagination-next');
            paginationItems.forEach(item => {
              // Avoid adding multiple listeners to the same element
              if (!item.dataset.autoSlidesMonitored) {
                item.dataset.autoSlidesMonitored = 'true';
                
                item.addEventListener('click', function() {
                  console.log('AUTOSLIDES_PAGINATION_CLICKED');
                  // Wait for the page to update
                  setTimeout(() => {
                    // Get updated current page
                    const activePage = document.querySelector('.ant-pagination-item-active');
                    if (activePage) {
                      const newPage = parseInt(activePage.textContent, 10) || 1;
                      console.log('AUTOSLIDES_PAGE_CHANGED:' + newPage);
                    }
                  }, 500);
                });
              }
            });
            
            // Also monitor the jump box
            const jumpBox = document.querySelector('.ant-pagination-options-quick-jumper input');
            if (jumpBox && !jumpBox.dataset.autoSlidesMonitored) {
              jumpBox.dataset.autoSlidesMonitored = 'true';
              jumpBox.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                  console.log('AUTOSLIDES_PAGINATION_JUMPED');
                  // Wait for the page to update
                  setTimeout(() => {
                    const activePage = document.querySelector('.ant-pagination-item-active');
                    if (activePage) {
                      const newPage = parseInt(activePage.textContent, 10) || 1;
                      console.log('AUTOSLIDES_PAGE_CHANGED:' + newPage);
                    }
                  }, 500);
                }
              });
            }
          };
          
          // Call immediately to set up monitoring
          setupPaginationMonitoring();
          
          // Also refresh pagination monitoring occasionally in case the DOM changes
          setInterval(setupPaginationMonitoring, 2000);
          
          // Loop through list items and inject buttons
          let buttonCount = 0;
          
          // Get the sessions for the current page
          const currentPageSessions = window.__autoSlidesSessions.filter(s => s.page === ${currentPage});
          const visibleSessions = currentPageSessions.length > 0 ? 
                                currentPageSessions : 
                                window.__autoSlidesSessions.slice(0, listItems.length);
          
          listItems.forEach((item, index) => {
            if (index >= visibleSessions.length) return;
            
            const session = visibleSessions[index];
            const actionList = item.querySelector('.ant-list-item-action');
            
            if (actionList) {
              // Create new list item for our button
              const newLi = document.createElement('li');
              
              // Create button
              const button = document.createElement('button');
              button.className = 'ant-btn ant-btn-round ant-btn-primary autoslides-btn';
              button.innerHTML = '<span>Add to Tasks</span>';
              button.setAttribute('data-session-id', session.sessionId);
              button.setAttribute('data-index', index);
              
              // Add onclick handler that uses console.log
              button.onclick = function() {
                // Find the actual index in the full sessions array
                const fullIndex = window.__autoSlidesSessions.findIndex(s => 
                  s.sessionId.toString() === session.sessionId.toString()
                );
                
                // Special prefix that we'll detect in the console-message event
                console.log('AUTOSLIDES_ADD_SESSION:' + JSON.stringify({
                  sessionId: session.sessionId,
                  index: fullIndex >= 0 ? fullIndex : index
                }));
                return false; // Prevent default
              };
              
              newLi.appendChild(button);
              actionList.insertBefore(newLi, actionList.firstChild);
              buttonCount++;
            } else {
              console.log('No action list found for item', index);
            }
          });
          
          // Add "Add All" button at the bottom
          const listContainer = document.querySelector('.ant-list');
          if (listContainer) {
            // Create the container for both elements
            const controlsContainer = document.createElement('div');
            controlsContainer.className = 'autoslides-controls-container';

            // Add pagination note on the left if needed
            if (${totalPages} > 1) {
              const paginationNote = document.createElement('div');
              paginationNote.className = 'autoslides-pagination-note';
              paginationNote.innerHTML = \`All ${totalPages} pages of courses loaded, ${sessions.length} sessions total\`;
              controlsContainer.appendChild(paginationNote);
            } else {
              // Add an empty div to maintain the flex layout
              const spacerDiv = document.createElement('div');
              controlsContainer.appendChild(spacerDiv);
            }
            
            const addAllButton = document.createElement('button');
            addAllButton.className = 'autoslides-btn-all';
            addAllButton.innerHTML = 'Add All Sessions to Task List';
            
            // Use console.log approach for add all button too
            addAllButton.onclick = function() {
              console.log('AUTOSLIDES_ADD_ALL_SESSIONS');
              return false; // Prevent default
            };

            // Add button to the container (will be on the right due to flexbox)
            controlsContainer.appendChild(addAllButton);
            
            // Add the button to the page
            listContainer.parentNode.insertBefore(controlsContainer, listContainer.nextSibling);
            console.log('Added controls container with "Add All" button');
          } else {
            console.log('No list container found for controls');
          }
          
          console.log('Successfully added', buttonCount, 'buttons');
          return { success: true, buttonCount, message: 'Button injection complete' };
        } catch (error) {
          console.error('Error injecting buttons:', error);
          return { success: false, error: error.toString() };
        }
      })();
    `);
  }


  // Listen for console messages from the webview which we use for communication
  webview.addEventListener('console-message', async (event) => {
    // Check for our special prefixes
    const message = event.message;
  
    if (message.startsWith('AUTOSLIDES_ADD_LIVE:')) {
      try {
        // Extract the JSON payload
        const jsonStr = message.substring('AUTOSLIDES_ADD_LIVE:'.length);
        const data = JSON.parse(jsonStr);
        
        console.log('Received add live course request from webview:', data);
        
        // Call the function with the data
        await addYanHeKTLiveToTasks(data.liveId, data.liveCourse);
      } catch (error) {
        console.error('Error processing add live course message:', error);
      }
    } else if (message === 'AUTOSLIDES_ADD_ALL_LIVES') {
      console.log('Received add all live courses request from webview');
      await addAllYanHeKTLivesToTasks();
    } else if (message === 'AUTOSLIDES_LIVE_PAGINATION_CLICKED') {
      console.log('Live pagination navigation detected');
    } else if (message.startsWith('AUTOSLIDES_LIVE_PAGE_CHANGED:')) {
      try {
        const newPage = parseInt(message.substring('AUTOSLIDES_LIVE_PAGE_CHANGED:'.length), 10);
        console.log('Live page changed to:', newPage);
        
        // Get the current URL
        const currentUrl = await webview.executeJavaScript('window.location.href');
        
        if (currentUrl.includes('yanhekt.cn/liveCourse')) {
          // Re-run the detection on the new page
          setTimeout(() => {
            detectYanHeKTLiveCourse(currentUrl);
          }, 1000);
        }
      } catch (error) {
        console.error('Error handling live page change:', error);
      }
    // Handle existing events for session courses
    } else if (message.startsWith('AUTOSLIDES_ADD_SESSION:')) {
      try {
        // Extract the JSON payload
        const jsonStr = message.substring('AUTOSLIDES_ADD_SESSION:'.length);
        const data = JSON.parse(jsonStr);
        
        console.log('Received add session request from webview:', data);
        
        // Call your function with the data
        await addYanHeKTSessionToTasks(data.sessionId, data.index);
      } catch (error) {
        console.error('Error processing add session message:', error);
      }
    } else if (message === 'AUTOSLIDES_ADD_ALL_SESSIONS') {
      console.log('Received add all sessions request from webview');
      await addAllYanHeKTSessionsToTasks();
    } else if (message === 'AUTOSLIDES_PAGINATION_CLICKED') {
      console.log('Pagination navigation detected');
    } else if (message.startsWith('AUTOSLIDES_PAGE_CHANGED:')) {
      try {
        const newPage = parseInt(message.substring('AUTOSLIDES_PAGE_CHANGED:'.length), 10);
        console.log('Page changed to:', newPage);
        
        // Get the current URL to extract course ID
        const currentUrl = await webview.executeJavaScript('window.location.href');
        const courseId = extractCourseId(currentUrl);
        
        if (courseId) {
          // Re-run the detection on the new page
          setTimeout(() => {
            detectYanHeKTCourse(currentUrl);
          }, 1000);
        }
      } catch (error) {
        console.error('Error handling page change:', error);
      }
    }
  });
  
  // Add a single YanHeKT session to task queue with course info
  async function addYanHeKTSessionToTasks(sessionId, indexOrCourseId) {
    try {
      console.log('Adding YanHeKT session to tasks:', sessionId, 'with indexOrCourseId:', indexOrCourseId);
      
      // Initialize sessions array if it doesn't exist
      if (!window.__autoSlidesSessions) {
        window.__autoSlidesSessions = [];
      }
      
      let session;
      let isUsingCourseId = false;
      
      // Check if we're dealing with an array index or a courseId
      if (typeof indexOrCourseId === 'number') {
        // Try to retrieve session from array first (original button injection method)
        if (indexOrCourseId >= 0 && indexOrCourseId < window.__autoSlidesSessions.length) {
          // This is a valid index into the __autoSlidesSessions array
          session = window.__autoSlidesSessions[indexOrCourseId];
        } else {
          // This might be a courseId rather than an index
          isUsingCourseId = true;
          console.log('Index is out of bounds, treating as courseId:', indexOrCourseId);
          
          // Create a synthetic session object with the courseId
          session = {
            sessionId: sessionId,
            courseId: indexOrCourseId, // Treat as courseId
            title: '', // We'll try to fetch this later
            weekNumber: null,
            dayOfWeek: null
          };
          
          // Store it in the array for future reference
          window.__autoSlidesSessions.push(session);
        }
      } else {
        // Non-numeric parameter - try to find session by sessionId
        console.log('Non-numeric parameter provided, searching for session by ID');
        const existingIndex = window.__autoSlidesSessions.findIndex(s => 
          s.sessionId.toString() === sessionId.toString()
        );
        
        if (existingIndex >= 0) {
          session = window.__autoSlidesSessions[existingIndex];
        } else {
          // Create a minimal session object
          session = {
            sessionId: sessionId,
            title: `Session ${sessionId}`,
            weekNumber: null,
            dayOfWeek: null
          };
          
          // If courseId was provided as a string
          if (typeof indexOrCourseId === 'string' && /^\d+$/.test(indexOrCourseId)) {
            session.courseId = parseInt(indexOrCourseId, 10);
            isUsingCourseId = true;
          }
          
          // Store it in the array
          window.__autoSlidesSessions.push(session);
        }
      }
      
      if (!session) {
        console.error('Failed to find or create session data');
        statusText.textContent = 'Error: Session data not available';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      // Rest of the function remains the same as your original implementation
      
      // Convert sessionId to string before checking if it's synthetic
      const sessionIdStr = String(sessionId);
      const isSynthetic = sessionIdStr.startsWith('auto_');
      
      if (isSynthetic) {
        statusText.textContent = 'Warning: Using synthetic session ID. Playback will not work correctly.';
        console.warn('Using synthetic session ID. Playback may not work correctly:', sessionId);
        
        // Ask user for confirmation
        const result = await webview.executeJavaScript(`
          confirm('Could not detect a valid session ID. Continue with synthetic ID? (Playback will not work correctly)')
        `);
        
        if (!result) {
          statusText.textContent = 'Session addition cancelled';
          setTimeout(() => {
            updateStatusConditional(captureInterval, 'capturing', 'idle');
          }, 2000);
          return;
        }
      }
      
      const yanHeKTProfileId = 'yanhekt_session';
      if (!siteProfiles[yanHeKTProfileId]) {
        console.error('YanHeKT profile not found in siteProfiles:', yanHeKTProfileId);
        statusText.textContent = 'Error: YanHeKT profile not found';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      // Check if this session is already in the task queue
      const existingTask = taskQueue.find(task => 
        task.profileId === yanHeKTProfileId && 
        task.taskId === sessionId.toString()
      );
      
      if (existingTask) {
        updateStatus('sessionAlreadyInQueue', {}, 3000);
        return;
      }
      
      // Get course information
      let courseInfo = '';
      try {
        // We'll use the courseId from our session object or the global courseId
        const courseId = session.courseId || await webview.executeJavaScript('window.__courseId || ""');
        
        if (!courseId) {
          throw new Error('Course ID not available');
        }
        
        console.log('Getting course info for courseId:', courseId);
        
        // Extract authentication token from localStorage
        const authInfo = await webview.executeJavaScript(`
          (function() {
            // Get auth data from localStorage (this is where YanHeKT stores it)
            let token = null;
            try {
              // First try to get from localStorage (primary method)
              const authData = localStorage.getItem('auth');
              if (authData) {
                const parsed = JSON.parse(authData);
                token = parsed.token;
              }
              
              // If not found in localStorage, try backup locations
              if (!token) {
                // Check alternative localStorage keys
                for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                  const value = localStorage.getItem(key);
                  if (value) {
                    token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                    break;
                  }
                }
              }
              
              // Last resort: try cookies
              if (!token) {
                const cookies = document.cookie.split(';');
                const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                if (tokenCookie) {
                  token = tokenCookie.split('=')[1].trim();
                }
              }
            } catch (e) {
              console.error('Error extracting token:', e);
            }
            
            // Get user agent for request headers
            const userAgent = navigator.userAgent;
            
            // Generate timestamp for request
            const timestamp = Math.floor(Date.now() / 1000).toString();
            
            return {
              token: token,
              userAgent: userAgent,
              timestamp: timestamp,
              traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
            };
          })();
        `);
        
        if (!authInfo.token) {
          throw new Error('Authentication token not found');
        }
        
        // API endpoint for course list - use makeApiRequest through main process
        const result = await window.electronAPI.makeApiRequest({
          url: 'https://cbiz.yanhekt.cn/v2/course/private/list?page=1&page_size=50&user_relationship_type=1&with_introduction=true',
          headers: {
            'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
            'Authorization': `Bearer ${authInfo.token}`,
            'Content-Type': 'application/json',
            'Origin': 'https://www.yanhekt.cn',
            'Referer': 'https://www.yanhekt.cn/',
            'User-Agent': authInfo.userAgent,
            'X-TRACE-ID': authInfo.traceId,
            'Xdomain-Client': 'web_user',
            'xclient-timestamp': authInfo.timestamp,
            'xclient-version': 'v2'
          }
        });
        
        if (result.code === 0 && result.data && result.data.data) {
          // Find the matching course
          const matchingCourse = result.data.data.find(c => c.id.toString() === courseId.toString());
          
          if (matchingCourse) {
            // Format course info
            courseInfo = `${matchingCourse.name_zh || ''} - ${session.title || session.week || ''}`;
            
            // Update the session title if it's empty
            if (!session.title && matchingCourse.name_zh) {
              session.title = matchingCourse.name_zh;
            }
          } else {
            // Fallback to just session info if course info not available
            courseInfo = session.title || session.week || '';
          }
        } else {
          // Fallback to just session info if course info API call failed
          courseInfo = session.title || session.week || '';
        }
      } catch (error) {
        console.error('Error getting course info:', error);
        // Fallback to basic session info
        courseInfo = session.title || session.week || '';
      }
      
      console.log('Using profile:', yanHeKTProfileId, 'for session:', sessionId);
  
      // Add to task queue with www subdomain for better compatibility
      taskQueue.push({
        profileId: yanHeKTProfileId,
        taskId: sessionId.toString(),
        url: `https://www.yanhekt.cn/session/${sessionId}`,
        profileName: siteProfiles[yanHeKTProfileId].name || yanHeKTProfileId,
        courseInfo: courseInfo // Add the course info to the task
      });
      
      console.log('Task queue updated:', taskQueue.length, 'tasks');
      
      // Update UI
      updateTaskTable();
      btnStartTasks.disabled = taskQueue.length === 0 || isProcessingTasks || !validateAutomationRequirements();
      
      // Open task manager
      if (taskManagerModal.style.display !== 'block') {
        openTaskManager();
      }
      
      updateStatus('sessionAdd', {}, 3000);
      
    } catch (error) {
      console.error('Error adding YanHeKT session to tasks:', error);
      statusText.textContent = `Error: ${error.message}`;
      setTimeout(() => {
        updateStatusConditional(captureInterval, 'capturing', 'idle');
      }, 3000);
    }
  }
  
  // Add all YanHeKT sessions to task queue with course info
  async function addAllYanHeKTSessionsToTasks(externalSessions = null) {
    try {
      console.log('Adding all YanHeKT sessions to tasks', externalSessions ? `(${externalSessions.length} provided externally)` : '');
      
      // Use either externally provided sessions or the ones from window.__autoSlidesSessions
      let sessions;
      if (externalSessions && Array.isArray(externalSessions)) {
        sessions = externalSessions;
        
        // Initialize window.__autoSlidesSessions if needed
        if (!window.__autoSlidesSessions) {
          window.__autoSlidesSessions = [];
        }
        
        // Add external sessions to window.__autoSlidesSessions if not already there
        for (const session of externalSessions) {
          // Skip if session is already in the array
          const existingIndex = window.__autoSlidesSessions.findIndex(s => 
            s.sessionId && session.id && s.sessionId.toString() === session.id.toString()
          );
          
          if (existingIndex === -1) {
            // Create a standardized session object and add it
            const sessionObj = {
              sessionId: session.id,
              courseId: session.courseId,
              title: session.title || `Session ${session.id}`,
              weekNumber: null,
              dayOfWeek: null
            };
            
            window.__autoSlidesSessions.push(sessionObj);
          }
        }
      } else {
        // Use existing window.__autoSlidesSessions
        sessions = await webview.executeJavaScript('window.__autoSlidesSessions');
        if (!sessions || !sessions.length) {
          console.error('No sessions found');
          statusText.textContent = 'No sessions found to add';
          setTimeout(() => {
            updateStatusConditional(captureInterval, 'capturing', 'idle');
          }, 3000);
          return;
        }
      }
      
      // Handle synthetic session IDs
      const syntheticSessions = sessions.filter(s => {
        const sessionId = s.sessionId || s.id;
        return String(sessionId).startsWith('auto_');
      });
      
      if (syntheticSessions.length > 0) {
        const confirmResult = await webview.executeJavaScript(`
          confirm('${syntheticSessions.length} session(s) have synthetic IDs which may not work correctly. Continue anyway?')
        `);
        
        if (!confirmResult) {
          statusText.textContent = 'Bulk session addition cancelled';
          setTimeout(() => {
            updateStatusConditional(captureInterval, 'capturing', 'idle');
          }, 2000);
          return;
        }
      }
      
      const yanHeKTProfileId = 'yanhekt_session';
      if (!siteProfiles[yanHeKTProfileId]) {
        console.error('YanHeKT profile not found in siteProfiles:', yanHeKTProfileId);
        statusText.textContent = 'Error: YanHeKT profile not found';
        setTimeout(() => {
          updateStatusConditional(captureInterval, 'capturing', 'idle');
        }, 3000);
        return;
      }
      
      // Get course information (once for all sessions)
      // This part gets more complex when handling sessions from multiple courses
      // Group sessions by courseId for efficient course info fetching
      const sessionsByCourseId = {};
      
      for (const session of sessions) {
        // Handle both formats (external sessions vs window.__autoSlidesSessions)
        const sessionId = session.sessionId || session.id;
        const courseId = session.courseId || await webview.executeJavaScript('window.__courseId || ""');
        
        if (!courseId) continue;
        
        if (!sessionsByCourseId[courseId]) {
          sessionsByCourseId[courseId] = [];
        }
        
        sessionsByCourseId[courseId].push({
          sessionId: sessionId,
          title: session.title || `Session ${sessionId}`
        });
      }
      
      // Fetch authentication token once for all requests
      let authInfo;
      try {
        authInfo = await webview.executeJavaScript(`
          (function() {
            // Get auth data from localStorage (this is where YanHeKT stores it)
            let token = null;
            try {
              // First try to get from localStorage (primary method)
              const authData = localStorage.getItem('auth');
              if (authData) {
                const parsed = JSON.parse(authData);
                token = parsed.token;
              }
              
              // If not found in localStorage, try backup locations
              if (!token) {
                // Check alternative localStorage keys
                for (const key of ['token', 'accessToken', 'yanhekt_token']) {
                  const value = localStorage.getItem(key);
                  if (value) {
                    token = value.replace(/^"|"$/g, ''); // Remove quotes if present
                    break;
                  }
                }
              }
              
              // Last resort: try cookies
              if (!token) {
                const cookies = document.cookie.split(';');
                const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
                if (tokenCookie) {
                  token = tokenCookie.split('=')[1].trim();
                }
              }
            } catch (e) {
              console.error('Error extracting token:', e);
            }
            
            // Get user agent for request headers
            const userAgent = navigator.userAgent;
            
            // Generate timestamp for request
            const timestamp = Math.floor(Date.now() / 1000).toString();
            
            return {
              token: token,
              userAgent: userAgent,
              timestamp: timestamp,
              traceId: 'AUTO-' + Math.random().toString(36).substring(2, 15)
            };
          })();
        `);
        
        if (!authInfo.token) {
          throw new Error('Authentication token not found');
        }
      } catch (error) {
        console.error('Error getting authentication token:', error);
      }
      
      // Fetch course info for all course IDs if we have auth info
      const courseNamesMap = {};
      if (authInfo && authInfo.token) {
        try {
          // Fetch all courses at once
          const result = await window.electronAPI.makeApiRequest({
            url: 'https://cbiz.yanhekt.cn/v2/course/private/list?page=1&page_size=50&user_relationship_type=1&with_introduction=true',
            headers: {
              'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8,zh-CN;q=0.7,zh;q=0.6',
              'Authorization': `Bearer ${authInfo.token}`,
              'Content-Type': 'application/json',
              'Origin': 'https://www.yanhekt.cn',
              'Referer': 'https://www.yanhekt.cn/',
              'User-Agent': authInfo.userAgent,
              'X-TRACE-ID': authInfo.traceId,
              'Xdomain-Client': 'web_user',
              'xclient-timestamp': authInfo.timestamp,
              'xclient-version': 'v2'
            }
          });
          
          if (result.code === 0 && result.data && result.data.data) {
            // Build a map of courseId to course name
            for (const course of result.data.data) {
              courseNamesMap[course.id] = course.name_zh || '';
            }
          }
        } catch (error) {
          console.error('Error getting course info for all sessions:', error);
        }
      }
      
      // Add each session to the task queue
      let addedCount = 0;
      for (const courseId in sessionsByCourseId) {
        const courseSessions = sessionsByCourseId[courseId];
        const courseName = courseNamesMap[courseId] || '';
        
        for (const session of courseSessions) {
          // Skip if already in queue
          if (taskQueue.some(task => task.taskId === session.sessionId.toString())) {
            continue;
          }
          
          // Format course info
          const courseInfo = courseName 
            ? `${courseName} - ${session.title || ''}`
            : (session.title || '');
          
          // Construct the URL
          const url = `https://www.yanhekt.cn/session/${session.sessionId}`;
          
          // Add to task queue
          taskQueue.push({
            profileId: 'yanhekt_session',
            taskId: session.sessionId.toString(),
            url,
            profileName: 'YanHeKT Session',
            courseInfo: courseInfo
          });
          
          addedCount++;
        }
      }
      
      // Update UI
      updateTaskTable();
      btnStartTasks.disabled = taskQueue.length === 0 || isProcessingTasks || !validateAutomationRequirements();
      
      // Open task manager
      if (taskManagerModal.style.display !== 'block') {
        openTaskManager();
      }
      
      updateStatus('allSessionAdd', { count: addedCount }, 3000);
      
    } catch (error) {
      console.error('Error adding all YanHeKT sessions to tasks:', error);
      statusText.textContent = `Error: ${error.message}`;
      setTimeout(() => {
        updateStatusConditional(captureInterval, 'capturing', 'idle');
      }, 3000);
    }
  }

  // Event listeners for task manager
  btnOpenTaskManager.addEventListener('click', openTaskManager);
  closeTaskManager.addEventListener('click', closeTaskManagerModal);
  btnAddTask.addEventListener('click', addTask);
  btnStartTasks.addEventListener('click', async () => {
    // Clear cache before starting tasks
    try {
      const result = await window.electronAPI.clearBrowserCache();
      
      if (result.success) {
        console.log('Cache cleared successfully before starting tasks');
      } else {
        console.warn('Failed to clear cache before starting tasks');
      }
      
      await updateCacheInfo();
    } catch (error) {
      console.error('Error clearing cache before starting tasks:', error);
    }
    
    // Continue with the existing task starting logic
    startTaskProcessing();
  });
  btnCancelTasks.addEventListener('click', cancelTaskProcessing);
  btnClearTasks.addEventListener('click', clearAllTasks);
  
  // Close modal when clicking outside of it
  window.addEventListener('click', (event) => {
    if (event.target === taskManagerModal) {
      closeTaskManagerModal();
    }
  });
  
  // Enter key in task ID input should add the task
  taskIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addTask();
    }
  });

  // Update validation when automation settings change
  autoDetectEnd.addEventListener('change', validateAutomationRequirements);
  autoStartPlayback.addEventListener('change', validateAutomationRequirements);
  autoDetectTitle.addEventListener('change', validateAutomationRequirements);

  // Modify the task profile select change handler to update validation
  taskProfileSelect.addEventListener('change', validateAutomationRequirements);

  // Add listeners to configuration fields
  inputCheckInterval.addEventListener('input', function() {
    saveConfig();
  });
  comparisonMethod.addEventListener('change', function() {
    saveConfig();
  });

  // Add home button functionality
  btnHome.addEventListener('click', async () => {
    let currentLanguage = 'en'; // Default to English
    try {
      currentLanguage = await window.i18n.getCurrentLanguage();
    } catch (error) {
      console.error('Error getting current language:', error);
      // Continue with default language if there's an error
    }
    const homepageFile = currentLanguage === 'zh' ? 'cn-homepage.html' : 'homepage.html';
    const homepageUrl = `file://${window.location.pathname.replace('index.html', homepageFile)}`;
    console.log('Navigating to homepage:', homepageUrl);
    webview.src = homepageUrl;
    inputUrl.value = '';
  });

  // Add event listener for double verification checkbox
  enableDoubleVerificationCheckbox.addEventListener('change', function() {
    saveConfig();
  });

  window.electronAPI.onApplyBlockingRules(() => {
    applyBlockingRules();
  });

  // Add event listener for automation checkbox, save immediately
  autoDetectEnd.addEventListener('change', function() {
    if (!activeProfileId || activeProfileId === 'default') return;
    
    // Update configuration in memory
    if (!siteProfiles[activeProfileId].automation) {
      siteProfiles[activeProfileId].automation = {};
    }
    siteProfiles[activeProfileId].automation.autoDetectEnd = this.checked;
    
    // Save to configuration
    saveConfig();
    
    // If task manager is open, update validation
    if (taskManagerModal.style.display === 'block') {
      validateAutomationRequirements();
    }
  });

  // Add similar event handlers for other checkboxes
  autoStartPlayback.addEventListener('change', function() {
    if (!activeProfileId || activeProfileId === 'default') return;
    
    if (!siteProfiles[activeProfileId].automation) {
      siteProfiles[activeProfileId].automation = {};
    }
    siteProfiles[activeProfileId].automation.autoStartPlayback = this.checked;
    
    saveConfig();
    
    if (taskManagerModal.style.display === 'block') {
      validateAutomationRequirements();
    }
  });

  autoAdjustSpeed.addEventListener('change', function() {
    if (!activeProfileId || activeProfileId === 'default') return;
    
    if (!siteProfiles[activeProfileId].automation) {
      siteProfiles[activeProfileId].automation = {};
    }
    siteProfiles[activeProfileId].automation.autoAdjustSpeed = this.checked;
    
    saveConfig();
  });

  autoDetectTitle.addEventListener('change', function() {
    if (!activeProfileId || activeProfileId === 'default') return;
    
    if (!siteProfiles[activeProfileId].automation) {
      siteProfiles[activeProfileId].automation = {};
    }
    siteProfiles[activeProfileId].automation.autoDetectTitle = this.checked;
    
    saveConfig();
    
    if (taskManagerModal.style.display === 'block') {
      validateAutomationRequirements();
    }
  });

  autoRetryError.addEventListener('change', function() {
    if (!activeProfileId || activeProfileId === 'default') return;
    
    if (!siteProfiles[activeProfileId].automation) {
      siteProfiles[activeProfileId].automation = {};
    }
    siteProfiles[activeProfileId].automation.autoRetryError = this.checked;
    
    saveConfig();
  });

  window.electronAPI.onUpdateProfiles((event, updatedProfiles) => {
    // Update in-memory profiles
    siteProfiles = updatedProfiles;
    
    // Update UI dropdown
    updateProfileDropdown();
    
    // If current profile was modified, reload its details
    if (activeProfileId && siteProfiles[activeProfileId]) {
        loadProfileDetails(activeProfileId);
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    // Only apply the change if the setting is 'system'
    window.electronAPI.getConfig().then(config => {
        if (config.darkMode === 'system') {
            if (e.matches) {
                document.documentElement.classList.add('dark-mode');
            } else {
                document.documentElement.classList.remove('dark-mode');
            }
        }
    });
  });

  // Handle add-task event from main process
  document.addEventListener('ipc-add-task', (event) => {
    try {
      const task = event.detail;
      console.log('Received task from remote API:', task);
      
      // Make sure task manager is open
      if (taskManagerModal.style.display !== 'block') {
        openTaskManager();
      }
      
      // Different handling based on task type
      if (task.type === 'session') {
        console.log('Adding session task with courseId:', task.courseId);
        
        // Create a synthetic session object and add it to window.__autoSlidesSessions
        // This matches the format expected by addYanHeKTSessionToTasks
        if (!window.__autoSlidesSessions) {
          window.__autoSlidesSessions = [];
        }
        
        // Create a session object with the format expected by the function
        const sessionObj = {
          sessionId: task.id,
          courseId: task.courseId,
          title: task.title || `Session ${task.id}`,
          // Add other fields that might be needed
          weekNumber: null,
          dayOfWeek: null
        };
        
        // Add to the global sessions array and get its index
        const existingIndex = window.__autoSlidesSessions.findIndex(s => 
          s.sessionId.toString() === task.id.toString()
        );
        
        let sessionIndex;
        if (existingIndex >= 0) {
          // Update existing session if found
          window.__autoSlidesSessions[existingIndex] = sessionObj;
          sessionIndex = existingIndex;
        } else {
          // Add new session and get its index
          window.__autoSlidesSessions.push(sessionObj);
          sessionIndex = window.__autoSlidesSessions.length - 1;
        }
        
        // Now call the function with proper parameters
        addYanHeKTSessionToTasks(task.id, sessionIndex);
        
      } else if (task.type === 'live') {
        // Create liveCourseData object with needed properties
        const liveCourseData = {
          title: task.title,
          courseName: task.title,
          liveId: task.id
        };
        
        // Call addYanHeKTLiveToTasks with proper parameters
        addYanHeKTLiveToTasks(task.id, liveCourseData);
      } else {
        // Fallback for custom URLs
        taskProfileSelect.value = 'custom_url';
        taskIdInput.value = task.url || task.id;
        addTask();
      }
      
    } catch (error) {
      console.error('Error handling add-task event:', error);
    }
  });
  
  // Handle add-tasks event from main process
  document.addEventListener('ipc-add-tasks', (event) => {
    try {
      const tasks = event.detail;
      console.log('Received tasks from remote API:', tasks);
      
      // Make sure task manager is open
      if (taskManagerModal.style.display !== 'block') {
        openTaskManager();
      }
      
      // Group tasks by type for bulk processing
      const sessionTasks = tasks.filter(task => task.type === 'session');
      const liveTasks = tasks.filter(task => task.type === 'live');
      const otherTasks = tasks.filter(task => task.type !== 'session' && task.type !== 'live');
      
      // Use bulk add for sessions if we have multiple
      if (sessionTasks.length > 0) {
        // Use the improved bulk add function
        addAllYanHeKTSessionsToTasks(sessionTasks);
      }
      
      // Handle live courses
      let liveAddedCount = 0;
      for (const task of liveTasks) {
        try {
          // Create liveCourseData object with needed properties
          const liveCourseData = {
            title: task.title,
            courseName: task.title,
            liveId: task.id
          };
          
          // Call addYanHeKTLiveToTasks with proper parameters
          addYanHeKTLiveToTasks(task.id, liveCourseData);
          liveAddedCount++;
        } catch (liveError) {
          console.error('Error adding live task:', liveError);
        }
      }
      
      // Handle other task types
      let otherAddedCount = 0;
      for (const task of otherTasks) {
        try {
          // Fallback to basic task addition
          const profileId = 'custom_url';
          
          taskProfileSelect.value = profileId;
          taskIdInput.value = task.url || task.id;
          addTask();
          otherAddedCount++;
        } catch (otherError) {
          console.error('Error adding other task:', otherError);
        }
      }
      
      console.log(`Added tasks from remote API: ${sessionTasks.length} sessions, ${liveAddedCount} live courses, ${otherAddedCount} other`);
      
      // Update UI status
      let statusMessage = '';
      if (sessionTasks.length > 0) statusMessage += `${sessionTasks.length} sessions`;
      if (liveAddedCount > 0) {
        if (statusMessage) statusMessage += ', ';
        statusMessage += `${liveAddedCount} live courses`;
      }
      if (otherAddedCount > 0) {
        if (statusMessage) statusMessage += ', ';
        statusMessage += `${otherAddedCount} other tasks`;
      }
      
      if (statusMessage) {
        updateStatus('icpAdd', { message: statusMessage }, 3000);
      }
      
    } catch (error) {
      console.error('Error handling add-tasks event:', error);
    }
  });
  
  // Handle start-tasks event from main process
  document.addEventListener('ipc-start-tasks', (event) => {
    try {
      const options = event.detail;
      console.log('Received command to start tasks with options:', options);
      
      // Make sure task manager is open
      if (taskManagerModal.style.display !== 'block') {
        openTaskManager();
      }
      
      // Set options if provided
      if (options) {
        if (typeof options.resetProgress === 'boolean') {
          resetProgressCheckbox.checked = options.resetProgress;
          resetVideoProgress = options.resetProgress;
        }
        
        if (typeof options.fastMode === 'boolean') {
          fastModeCheckbox.checked = options.fastMode;
          fastModeEnabled = options.fastMode;
          try { updateFastModeIndicator(); } catch (e) {}
        }
        
        // Add this block to handle autoMute option
        if (typeof options.autoMute === 'boolean') {
          autoMuteCheckbox.checked = options.autoMute;
          autoMuteEnabled = options.autoMute;
          console.log('Auto-mute option set to:', autoMuteEnabled);
        }
      }
      
      // Start tasks if there are any in the queue
      if (taskQueue.length > 0 && !isProcessingTasks) {
        startTaskProcessing();
        console.log('Tasks started successfully');
      } else {
        console.log('Cannot start tasks: Queue is empty or tasks are already running');
      }
    } catch (error) {
      console.error('Error handling start-tasks event:', error);
    }
  });
  
  // Handle cancel-tasks event from main process
  document.addEventListener('ipc-cancel-tasks', () => {
    try {
      console.log('Received command to cancel tasks');
      
      // Cancel tasks if they are running
      if (isProcessingTasks) {
        cancelTaskProcessing();
        console.log('Tasks canceled from remote API');
      } else {
        console.log('No tasks are currently running');
      }
    } catch (error) {
      console.error('Error handling cancel-tasks event:', error);
    }
  });
  
  // Handle get-task-status event from main process
  document.addEventListener('ipc-get-task-status', (event) => {
    try {
      const { responseChannel } = event.detail;
      console.log('Received request for task status');
      
      // Gather task status information
      const status = {
        success: true,
        isProcessing: isProcessingTasks,
        currentTaskIndex: currentTaskIndex,
        totalTasks: taskQueue.length,
        status: document.getElementById('statusText').textContent,
        slideCount: document.getElementById('slideCount').textContent
      };
      
      // If there is a current task, include its information
      if (isProcessingTasks && currentTaskIndex >= 0 && currentTaskIndex < taskQueue.length) {
        status.currentTask = {
          type: taskQueue[currentTaskIndex].profileId === 'yanhekt_session' ? 'session' : 
                taskQueue[currentTaskIndex].profileId === 'yanhekt_live' ? 'live' : 'custom',
          id: taskQueue[currentTaskIndex].taskId,
          title: taskQueue[currentTaskIndex].title || 'Untitled Task'
        };
      }
      
      // Send the status back to the main process
      window.electronAPI.sendTaskStatus(responseChannel, status);
      
      console.log('Task status sent:', status);
    } catch (error) {
      console.error('Error handling get-task-status event:', error);
      
      // Send error response
      if (event.detail && event.detail.responseChannel) {
        window.electronAPI.sendTaskStatus(event.detail.responseChannel, {
          success: false,
          error: error.toString()
        });
      }
    }
  });

  // Handle get-tasks event from main process
  document.addEventListener('ipc-get-tasks', (event) => {
    try {
      const { responseChannel } = event.detail;
      console.log('Received request for tasks');
      
      // Gather task data
      const tasks = taskQueue.map((task, index) => {
        return {
          index,
          profileId: task.profileId,
          profileName: task.profileName || task.profileId,
          taskId: task.taskId,
          url: task.url,
          courseInfo: task.courseInfo || '',
          title: task.title || ''
        };
      });
      
      // Send the tasks back to the main process
      window.electronAPI.sendTaskStatus(responseChannel, {
        success: true,
        tasks,
        isProcessing: isProcessingTasks,
        currentTaskIndex: currentTaskIndex
      });
      
      console.log('Task list sent:', tasks.length);
    } catch (error) {
      console.error('Error handling get-tasks event:', error);
      
      // Send error response
      if (event.detail && event.detail.responseChannel) {
        window.electronAPI.sendTaskStatus(event.detail.responseChannel, {
          success: false,
          error: error.toString()
        });
      }
    }
  });
  
  // Handle remove-task event from main process
  document.addEventListener('ipc-remove-task', (event) => {
    try {
      const { index, responseChannel } = event.detail;
      console.log('Received request to remove task at index:', index);
      
      // Check if index is valid
      if (index < 0 || index >= taskQueue.length) {
        window.electronAPI.sendTaskStatus(responseChannel, {
          success: false,
          message: 'Invalid task index'
        });
        return;
      }
      
      // Check if we can remove this task
      if (isProcessingTasks && index === currentTaskIndex) {
        window.electronAPI.sendTaskStatus(responseChannel, {
          success: false,
          message: 'Cannot remove task that is currently processing'
        });
        return;
      }
      
      // Remove the task
      taskQueue.splice(index, 1);
      
      // If removing a task before current task, adjust current task index
      if (isProcessingTasks && index < currentTaskIndex) {
        currentTaskIndex--;
      }
      
      // Update UI
      updateTaskTable();
      
      // Send success response
      window.electronAPI.sendTaskStatus(responseChannel, {
        success: true,
        message: 'Task removed',
        remainingTasks: taskQueue.length
      });
      
    } catch (error) {
      console.error('Error handling remove-task event:', error);
      
      // Send error response
      if (event.detail && event.detail.responseChannel) {
        window.electronAPI.sendTaskStatus(event.detail.responseChannel, {
          success: false,
          error: error.toString()
        });
      }
    }
  });
  
  // Handle clear-tasks event from main process
  document.addEventListener('ipc-clear-tasks', (event) => {
    try {
      const { responseChannel } = event.detail;
      console.log('Received request to clear all tasks');
      
      // Check if tasks are currently processing
      if (isProcessingTasks) {
        window.electronAPI.sendTaskStatus(responseChannel, {
          success: false,
          message: 'Cannot clear tasks while processing is in progress'
        });
        return;
      }
      
      // Clear the task queue
      taskQueue = [];
      
      // Update UI
      updateTaskTable();
      
      // Send success response
      window.electronAPI.sendTaskStatus(responseChannel, {
        success: true,
        message: 'All tasks cleared'
      });
      
    } catch (error) {
      console.error('Error handling clear-tasks event:', error);
      
      // Send error response
      if (event.detail && event.detail.responseChannel) {
        window.electronAPI.sendTaskStatus(event.detail.responseChannel, {
          success: false,
          error: error.toString()
        });
      }
    }
  });
});