// First declare all your DOM element variables
document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const webview = document.getElementById('slideWebview');
  const btnStartCapture = document.getElementById('btnStartCapture');
  const btnStopCapture = document.getElementById('btnStopCapture');
  const btnLoadUrl = document.getElementById('btnLoadUrl');
  const btnSelectDir = document.getElementById('btnSelectDir');
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  const btnDefaultConfig = document.getElementById('btnDefaultConfig');
  const inputUrl = document.getElementById('inputUrl');
  const inputOutputDir = document.getElementById('inputOutputDir');
  const inputTopCrop = document.getElementById('inputTopCrop');
  const inputBottomCrop = document.getElementById('inputBottomCrop');
  const inputChangeThreshold = document.getElementById('inputChangeThreshold');
  const inputCheckInterval = document.getElementById('inputCheckInterval');
  const statusText = document.getElementById('statusText');
  const slideCount = document.getElementById('slideCount');
  const blockingRules = document.getElementById('blockingRules');
  const btnApplyRules = document.getElementById('btnApplyRules');
  const btnResetRules = document.getElementById('btnResetRules');
  const topCropGuide = document.getElementById('topCropGuide');
  const bottomCropGuide = document.getElementById('bottomCropGuide');
  const cropGuides = document.querySelector('.crop-guides');
  const cropInfoOverlay = document.getElementById('cropInfoOverlay');
  const btnShowCropGuides = document.getElementById('btnShowCropGuides');
  const cacheInfo = document.getElementById('cacheInfo');
  const btnClearCache = document.getElementById('btnClearCache');
  const btnClearCookies = document.getElementById('btnClearCookies');
  const btnClearAll = document.getElementById('btnClearAll');
  const cacheCleanInterval = document.getElementById('cacheCleanInterval');
  const siteProfileSelect = document.getElementById('siteProfileSelect');
  const elementSelector = document.getElementById('elementSelector');
  const urlPattern = document.getElementById('urlPattern');
  const btnSaveProfile = document.getElementById('btnSaveProfile');
  const btnDeleteProfile = document.getElementById('btnDeleteProfile');
  const profileDetails = document.getElementById('profileDetails');
  const toggleAdvancedSettings = document.getElementById('toggleAdvancedSettings');
  const advancedSettingsContent = document.getElementById('advancedSettingsContent');
  const automationSection = document.getElementById('automationSection');
  const toggleAutomation = document.getElementById('toggleAutomation');
  const automationContent = document.getElementById('automationContent');
  const autoDetectEnd = document.getElementById('autoDetectEnd');
  const endDetectionSelector = document.getElementById('endDetectionSelector');
  const autoStartPlayback = document.getElementById('autoStartPlayback');
  const playButtonSelector = document.getElementById('playButtonSelector');
  const countdownSelector = document.getElementById('countdownSelector');
  const allowBackgroundRunning = document.getElementById('allowBackgroundRunning');

  // Capture related variables
  let captureInterval = null;
  let lastImageData = null;
  let capturedCount = 0;
  let cropGuideTimer = null;
  let cacheCleanupTimer = null;
  let siteProfiles = {};
  let activeProfileId = 'default';
  let currentProfile = null;
  let autoStartCheckInterval = null; // Add this line

  // Default rules
  const DEFAULT_RULES = `yanhekt.cn###root > div.app > div.sidebar-open:first-child
yanhekt.cn###root > div.app > div.BlankLayout_layout__kC9f3:last-child > div.ant-spin-nested-loading:nth-child(2) > div.ant-spin-container > div.index_liveWrapper__YGcpO > div.index_userlist__T-6xf:last-child > div.index_staticContainer__z3yt-
yanhekt.cn###ai-bit-shortcut`;

  // Enhance the blocking rules text area for code-like behavior
  function enhanceBlockingRulesEditor() {
    // Enable tab key in the textarea (instead of changing focus)
    blockingRules.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault();
        
        // Insert a tab character at the cursor position
        const start = this.selectionStart;
        const end = this.selectionEnd;
        
        this.value = this.value.substring(0, start) + '    ' + this.value.substring(end);
        
        // Put the cursor after the tab
        this.selectionStart = this.selectionEnd = start + 4;
      }
    });
  }

  // Add this call after loading the blocking rules
  await loadConfig();
  await loadBlockingRules();
  enhanceBlockingRulesEditor();
  
  // Set default URL
  inputUrl.value = 'https://www.yanhekt.cn/home';
  
  // Load default URL when app starts
  setTimeout(() => {
    const defaultUrl = 'https://www.yanhekt.cn/home';
    
    // Only set if not already set
    if (webview.src === 'about:blank' || !webview.src) {
      webview.src = defaultUrl;
      inputUrl.value = defaultUrl;
      statusText.textContent = 'Loading default URL...';
    }
  }, 200);

  setInterval(() => {
    if (webview.src && webview.src !== 'about:blank' && webview.src !== inputUrl.value) {
      inputUrl.value = webview.src;
      
      // Check for trigger
      if (checkUrlForCropGuidesTrigger(webview.src)) {
        console.log('URL contains crop guides trigger (periodic check), showing guides');
        updateCropGuides(true);
      }
    }
  }, 1000);

  // Function definitions
  function loadURL() {
    const url = inputUrl.value;
    if (url) {
      const loaded = safeLoadURL(url);
      if (loaded && checkUrlForCropGuidesTrigger(url)) {
        setTimeout(() => updateCropGuides(), 1000);
      }
    }
  }

  function safeLoadURL(url) {
    if (url && typeof url === 'string' && url.trim() !== '') {
      try {
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
      inputTopCrop.value = config.topCropPercent || 5;
      inputBottomCrop.value = config.bottomCropPercent || 5;
      inputChangeThreshold.value = config.changeThreshold || 0.005;
      inputCheckInterval.value = config.checkInterval || 2;
      
      // Load cache clean interval
      cacheCleanInterval.value = config.cacheCleanInterval || 15;
      
      // Load site profiles with default built-in profiles
      siteProfiles = config.siteProfiles || {
        yanhekt_session: {
          name: 'YanHeKT Session Player',
          elementSelector: '#video_id_topPlayer_html5_api',
          urlPattern: 'yanhekt.cn/session',
          builtin: true,
          automation: {
            autoDetectEnd: true,
            endDetectionSelector: '.player-ended-poster'
          }
        },
        yanhekt_live: {
          name: 'YanHeKT Live Player',
          elementSelector: '#video_id_mainPlayer_html5_api',
          urlPattern: 'yanhekt.cn/live',
          builtin: true,
          automation: {
            autoDetectEnd: true,
            endDetectionSelector: '.VideoResult_result__LdbB3'
          }
        }
      };
      
      // Set default active profile to Live Player
      activeProfileId = config.activeProfileId || 'yanhekt_live';
      
      // Populate profile dropdown
      updateProfileDropdown();
      
      // Select active profile
      siteProfileSelect.value = activeProfileId;
      loadProfileDetails(activeProfileId);

      allowBackgroundRunning.checked = config.allowBackgroundRunning || false;
      
      return config;
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  }
  
  async function saveConfig() {
    try {
      const config = {
        outputDir: inputOutputDir.value,
        topCropPercent: parseFloat(inputTopCrop.value),
        bottomCropPercent: parseFloat(inputBottomCrop.value),
        changeThreshold: parseFloat(inputChangeThreshold.value),
        checkInterval: parseFloat(inputCheckInterval.value),
        cacheCleanInterval: parseInt(cacheCleanInterval.value, 10),
        siteProfiles: siteProfiles,
        activeProfileId: activeProfileId,
        allowBackgroundRunning: allowBackgroundRunning.checked
      };
      
      await window.electronAPI.saveConfig(config);
      statusText.textContent = 'Settings saved';
      setTimeout(() => {
        statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
      }, 2000);
    } catch (error) {
      console.error('Failed to save config:', error);
      statusText.textContent = 'Error saving settings';
    }
  }

  async function resetConfigToDefaults() {
    // Default values from schema in main.js
    const defaultConfig = {
      outputDir: await window.electronAPI.getConfig().then(config => config.outputDir), // Keep output dir as is
      topCropPercent: 5,
      bottomCropPercent: 5,
      changeThreshold: 0.005,
      checkInterval: 2,
      allowBackgroundRunning: false // Add this line to reset background running
    };
    
    // Update input fields
    inputTopCrop.value = defaultConfig.topCropPercent;
    inputBottomCrop.value = defaultConfig.bottomCropPercent;
    inputChangeThreshold.value = defaultConfig.changeThreshold;
    inputCheckInterval.value = defaultConfig.checkInterval;
    allowBackgroundRunning.checked = defaultConfig.allowBackgroundRunning; // Update checkbox state
    
    // Save to config
    await window.electronAPI.saveConfig(defaultConfig);
    statusText.textContent = 'Settings reset to defaults';
    setTimeout(() => {
      statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
    }, 2000);
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
      // Hide profile details for default
      profileDetails.classList.add('hidden');
      automationSection.classList.add('hidden'); // Hide automation for default profile
      currentProfile = null;
      return;
    }
    
    profileDetails.classList.remove('hidden');
    automationSection.classList.remove('hidden'); // Show automation for non-default profiles
    
    if (profileId === 'custom') {
      // New custom profile
      elementSelector.value = '';
      urlPattern.value = '';
      autoDetectEnd.checked = false;
      endDetectionSelector.value = '';
      autoStartPlayback.checked = false;
      playButtonSelector.value = '';
      countdownSelector.value = '';
      currentProfile = null;
      return;
    }
    
    // Load existing profile
    const profile = siteProfiles[profileId];
    if (profile) {
      elementSelector.value = profile.elementSelector || '';
      urlPattern.value = profile.urlPattern || '';
      
      if (profile.automation) {
        autoDetectEnd.checked = profile.automation.autoDetectEnd || false;
        endDetectionSelector.value = profile.automation.endDetectionSelector || '';
        autoStartPlayback.checked = profile.automation.autoStartPlayback || false;
        playButtonSelector.value = profile.automation.playButtonSelector || '';
        countdownSelector.value = profile.automation.countdownSelector || '';
      } else {
        autoDetectEnd.checked = false;
        endDetectionSelector.value = '';
        autoStartPlayback.checked = false;
        playButtonSelector.value = '';
        countdownSelector.value = '';
      }
      
      currentProfile = profile;
    }
  }
  
  function saveCurrentProfile() {
    if (siteProfileSelect.value === 'default') {
      return; // Nothing to save
    }
    
    const automationSettings = {
      autoDetectEnd: autoDetectEnd.checked,
      endDetectionSelector: endDetectionSelector.value,
      autoStartPlayback: autoStartPlayback.checked,
      playButtonSelector: playButtonSelector.value,
      countdownSelector: countdownSelector.value
    };
    
    if (siteProfileSelect.value === 'custom') {
      // Generate a new profile ID
      const profileId = 'profile_' + Date.now();
      const profileName = urlPattern.value ? `${urlPattern.value.split(' ')[0]} Profile` : 'Custom Profile';
      
      // Create new profile
      siteProfiles[profileId] = {
        name: profileName,
        elementSelector: elementSelector.value,
        urlPattern: urlPattern.value,
        automation: automationSettings
      };
      
      // Update dropdown and select new profile
      updateProfileDropdown();
      siteProfileSelect.value = profileId;
      activeProfileId = profileId;
    } else {
      // Update existing profile
      const profileId = siteProfileSelect.value;
      siteProfiles[profileId].elementSelector = elementSelector.value;
      siteProfiles[profileId].urlPattern = urlPattern.value;
      siteProfiles[profileId].automation = automationSettings;
      activeProfileId = profileId;
    }
    
    // Save config
    saveConfig();
    statusText.textContent = 'Profile saved';
    setTimeout(() => {
      statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
    }, 2000);
  }
  
  function deleteCurrentProfile() {
    const profileId = siteProfileSelect.value;
    
    // Prevent deletion of built-in profiles and Default profile
    if (profileId === 'default' || (siteProfiles[profileId] && siteProfiles[profileId].builtin)) {
      statusText.textContent = 'Cannot delete built-in profile';
      setTimeout(() => {
        statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
      }, 2000);
      return;
    }
    
    if (profileId !== 'custom') {
      delete siteProfiles[profileId];
      updateProfileDropdown();
      siteProfileSelect.value = 'default';
      loadProfileDetails('default');
      activeProfileId = 'default';
      saveConfig();
      statusText.textContent = 'Profile deleted';
      setTimeout(() => {
        statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
      }, 2000);
    }
  }

  async function updateCacheInfo() {
    try {
      cacheInfo.textContent = 'Calculating cache size...';
      const cacheData = await window.electronAPI.getCacheSize();
      cacheInfo.textContent = `Total cache: ${cacheData.totalMB} MB`;
      
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
      cacheInfo.textContent = 'Clearing browser cache...';
      btnClearCache.disabled = true;
      
      const result = await window.electronAPI.clearBrowserCache();
      
      if (result.success) {
        statusText.textContent = 'Browser cache cleared';
        setTimeout(() => {
          statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
        }, 2000);
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
  
  // Clear cookies
  async function clearCookies() {
    try {
      cacheInfo.textContent = 'Clearing cookies...';
      btnClearCookies.disabled = true;
      
      const result = await window.electronAPI.clearCookies();
      
      if (result.success) {
        statusText.textContent = 'Cookies cleared';
        setTimeout(() => {
          statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
        }, 2000);
      } else {
        statusText.textContent = 'Failed to clear cookies';
      }
      
      await updateCacheInfo();
      btnClearCookies.disabled = false;
    } catch (error) {
      console.error('Error clearing cookies:', error);
      statusText.textContent = 'Error clearing cookies';
      btnClearCookies.disabled = false;
    }
  }
  
  // Clear all data
  async function clearAllData() {
    try {
      cacheInfo.textContent = 'Clearing all data...';
      btnClearAll.disabled = true;
      
      const result = await window.electronAPI.clearAllData();
      
      if (result.success) {
        statusText.textContent = 'All cache data cleared';
        setTimeout(() => {
          statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
        }, 2000);
      } else {
        statusText.textContent = 'Failed to clear all data';
      }
      
      await updateCacheInfo();
      btnClearAll.disabled = false;
    } catch (error) {
      console.error('Error clearing all data:', error);
      statusText.textContent = 'Error clearing all data';
      btnClearAll.disabled = false;
    }
  }

  // Set up automatic cache cleanup
  function setupCacheCleanupTimer() {
    // Clear any existing timer
    if (cacheCleanupTimer) {
      clearInterval(cacheCleanupTimer);
      cacheCleanupTimer = null;
    }
    
    // Get the interval in minutes
    const interval = parseInt(cacheCleanInterval.value, 10);
    
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
  }
  
  async function loadBlockingRules() {
    try {
      const rules = await window.electronAPI.getBlockingRules();
      blockingRules.value = rules || DEFAULT_RULES;
    } catch (error) {
      console.error('Failed to load blocking rules:', error);
      blockingRules.value = DEFAULT_RULES;
    }
  }

  // Function to update the crop guide positions
  function updateCropGuides(isAutomatic = false) {
    // Get webview dimensions
    const webviewHeight = webview.clientHeight;
    
    // Calculate guide positions based on crop percentages
    const topCropPercent = parseFloat(inputTopCrop.value) || 0;
    const bottomCropPercent = parseFloat(inputBottomCrop.value) || 0;
    
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
    
    // Set timer to hide guides - 6 seconds for automatic triggers, 3 seconds for manual
    const hideDelay = isAutomatic ? 6000 : 3000;
    cropGuideTimer = setTimeout(() => {
      cropGuides.classList.remove('visible');
      if (btnShowCropGuides.textContent === 'Hide Crop Guides') {
        btnShowCropGuides.textContent = 'Show Crop Guides';
      }
    }, hideDelay);
  }

  function checkUrlForCropGuidesTrigger(url) {
    // Since this feature has been removed, always return false
    return false;
  }
  
  async function saveBlockingRules() {
    try {
      await window.electronAPI.saveBlockingRules(blockingRules.value);
      statusText.textContent = 'Blocking rules saved';
      setTimeout(() => {
        statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
      }, 2000);
    } catch (error) {
      console.error('Failed to save blocking rules:', error);
    }
  }
  
  function applyBlockingRules() {
    const rules = blockingRules.value.trim().split('\n');
    if (!webview.src || webview.src === 'about:blank') {
      statusText.textContent = 'No page loaded to apply rules';
      return;
    }
    
    try {
      const currentUrl = new URL(webview.src);
      const currentDomain = currentUrl.hostname;
      
      let cssToInject = '';
      let appliedRules = 0;
      
      rules.forEach(rule => {
        if (!rule || rule.startsWith('#')) return; // Skip empty lines or comments
        
        const parts = rule.split('##');
        if (parts.length !== 2) return; // Skip invalid rules
        
        const ruleDomain = parts[0];
        const selector = parts[1];
        
        // Check if rule applies to current domain
        if (currentDomain.endsWith(ruleDomain) || 
            currentDomain === `www.${ruleDomain}` ||
            ruleDomain === '*') {
          cssToInject += `${selector} { display: none !important; }\n`;
          appliedRules++;
        }
      });
      
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
              const selectors = [${rules
                .filter(rule => rule && !rule.startsWith('#'))
                .map(rule => {
                  const parts = rule.split('##');
                  if (parts.length !== 2) return null;
                  return JSON.stringify(parts[1]);
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
            statusText.textContent = `Applied ${appliedRules} blocking rules`;
            setTimeout(() => {
              statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
            }, 2000);
          })
          .catch(err => {
            console.error('Error applying blocking rules:', err);
            statusText.textContent = 'Error applying rules';
          });
      } else {
        statusText.textContent = 'No applicable rules for current page';
        setTimeout(() => {
          statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
        }, 2000);
      }
    } catch (error) {
      console.error('Error in applyBlockingRules:', error);
      statusText.textContent = 'Error processing rules';
    }
  }
  
  function resetRules() {
    blockingRules.value = DEFAULT_RULES;
    saveBlockingRules();
    applyBlockingRules();
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
            statusText.textContent = `Switched to ${profile.name} profile`;
            setTimeout(() => {
              statusText.textContent = 'Idle';
            }, 2000);
            return;
          }
        }
      }
    }
  }

  // Crop image based on current settings
  function cropImage(imageData) {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const topCrop = Math.floor(img.height * (parseFloat(inputTopCrop.value) / 100));
        const bottomCrop = Math.floor(img.height * (1 - parseFloat(inputBottomCrop.value) / 100));
        
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
  
  // Compare images for changes
  function compareImages(img1Data, img2Data) {
    return new Promise((resolve) => {
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

          const topCrop = Math.floor(img1.height * (parseFloat(inputTopCrop.value) / 100));
          const bottomCrop = Math.floor(img1.height * (1 - parseFloat(inputBottomCrop.value) / 100));

          ctx1.drawImage(img1, 0, topCrop, img1.width, bottomCrop - topCrop, 0, 0, img1.width, bottomCrop - topCrop);
          ctx2.drawImage(img2, 0, topCrop, img2.width, bottomCrop - topCrop, 0, 0, img2.width, bottomCrop - topCrop);

          const data1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
          const data2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);

          let diffCount = 0;
          const threshold = 30; // Pixel difference threshold
          
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

          const totalPixels = (canvas1.width * canvas1.height);
          const changeRatio = diffCount / totalPixels;
          
          resolve({
            changed: changeRatio > parseFloat(inputChangeThreshold.value),
            changeRatio
          });
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
    statusText.textContent = 'Capturing...';
    
    // Setup the automatic cache cleanup timer
    setupCacheCleanupTimer();

    if (allowBackgroundRunning.checked) {
      try {
        await window.electronAPI.enableBackgroundRunning();
        console.log('Background running enabled for capture session');
      } catch (error) {
        console.error('Failed to enable background running:', error);
      }
    }
    
    // Capture first slide
    try {
      // Use local timestamp instead of ISO string
      const timestamp = formatLocalTimestamp();
      const imageData = await captureScreenshot();
      
      // Store the uncropped image for comparison
      lastImageData = imageData;
      
      // If using element capture, don't crop the image
      const isUsingElementCapture = activeProfileId !== 'default';
      const finalImageData = isUsingElementCapture ? imageData : await cropImage(imageData);
      
      await window.electronAPI.saveSlide({ imageData: finalImageData, timestamp });
      capturedCount++;
      slideCount.textContent = `Slides captured: ${capturedCount}`;
      
      // Start interval for checking slide changes
      captureInterval = setInterval(async () => {
        const playbackEnded = await checkPlaybackEnded();
        if (playbackEnded) return;
        
        const currentImageData = await captureScreenshot();
        const result = await compareImages(lastImageData, currentImageData);
        
        if (result.changed) {
          // Use local timestamp for each new slide
          const timestamp = formatLocalTimestamp();
          
          // Store the uncropped image for future comparisons
          lastImageData = currentImageData;
          
          // If using element capture, don't crop the image
          const finalImageData = isUsingElementCapture ? currentImageData : await cropImage(currentImageData);
          
          await window.electronAPI.saveSlide({ imageData: finalImageData, timestamp });
          capturedCount++;
          slideCount.textContent = `Slides captured: ${capturedCount}`;
          console.log(`Saved new slide (change ratio: ${result.changeRatio.toFixed(4)})`);
        }
      }, parseFloat(inputCheckInterval.value) * 1000);
    } catch (error) {
      console.error('Error starting capture:', error);
      statusText.textContent = 'Error: ' + error.message;
    }
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

      try {
        await window.electronAPI.disableBackgroundRunning();
        console.log('Background running disabled after capture');
      } catch (error) {
        console.error('Failed to disable background running:', error);
      }
      
      btnStartCapture.disabled = false;
      btnStopCapture.disabled = true;
      statusText.textContent = 'Capture stopped, cleaning up...';
      
      // Clean up cache after stopping
      window.electronAPI.clearBrowserCache()
        .then(() => {
          return updateCacheInfo();
        })
        .then(() => {
          statusText.textContent = 'Capture stopped, cache cleared';
          setTimeout(() => {
            statusText.textContent = 'Idle';
          }, 2000);
        })
        .catch(error => {
          console.error('Error cleaning cache on stop:', error);
          statusText.textContent = 'Capture stopped';
        });
    }
  }
  
  // Set event listeners for page loading
  webview.addEventListener('did-start-loading', () => {
    statusText.textContent = 'Loading page...';
  });
  
  webview.addEventListener('did-finish-load', () => {
    // Update URL field
    if (webview.src) {
      inputUrl.value = webview.src;
    }
    
    statusText.textContent = 'Page loaded, applying rules...';
    // Short delay to ensure page is fully rendered
    setTimeout(() => {
      applyBlockingRules();
      
      // Check URL for trigger after loading is complete
      if (checkUrlForCropGuidesTrigger(webview.src)) {
        console.log('URL contains crop guides trigger after page load, showing guides');
        updateCropGuides(true);
      }
    }, 500);
    
    // Add this block for auto-start playback check
    if (activeProfileId !== 'default' && 
        siteProfiles[activeProfileId]?.automation?.autoStartPlayback && 
        urlMatchesProfilePatterns(webview.src, activeProfileId)) {
      
      console.log('URL matches profile pattern, initiating auto-start playback check');
      statusText.textContent = 'Checking for play button...';
      
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
  });

  webview.addEventListener('did-fail-load', (event) => {
    if (event.errorCode !== -3) { // Ignore aborted loads
      statusText.textContent = `Load failed: ${event.errorDescription}`;
    }
  });

  // Also intercept links that try to open in a new frame
  webview.addEventListener('will-navigate', (e) => {
    statusText.textContent = 'Navigating...';
  });

  webview.addEventListener('did-navigate', (e) => {
    // Update URL field
    inputUrl.value = e.url;
    statusText.textContent = 'Page loaded';
    
    // Check if URL matches trigger
    if (checkUrlForCropGuidesTrigger(e.url)) {
      console.log('URL contains crop guides trigger in did-navigate, showing guides');
      setTimeout(() => updateCropGuides(true), 500); // true = automatic trigger
    }
  });

  // Add event listener for in-page navigation (hash changes, etc)
  webview.addEventListener('did-navigate-in-page', (e) => {
    if (e.isMainFrame && e.url) {
      inputUrl.value = e.url;
      
      // Check if URL matches trigger
      if (checkUrlForCropGuidesTrigger(e.url)) {
        console.log('URL contains crop guides trigger in did-navigate-in-page, showing guides');
        setTimeout(() => updateCropGuides(true), 500);
      }
    }
  });
  
  webview.addEventListener('new-window', (e) => {
    e.preventDefault();
    if (e.url) {
      console.log('Intercepted new window:', e.url);
      safeLoadURL(e.url);
    }
  });
  
  // Inject a simpler but more robust script for handling links
  webview.addEventListener('dom-ready', () => {
    webview.executeJavaScript(`
      (function() {
        // Only set up once
        if (window._autoSlidesLinkHandlerInstalled) return;
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
      })();
    `).catch(err => console.error('Error injecting link handler:', err));
  });

  // Add event listeners to crop input fields
  inputTopCrop.addEventListener('input', () => updateCropGuides(false));
  inputBottomCrop.addEventListener('input', () => updateCropGuides(false));

  // Also show guides when focusing the inputs
  inputTopCrop.addEventListener('focus', () => updateCropGuides(false));
  inputBottomCrop.addEventListener('focus', () => updateCropGuides(false));

  // Update guides if webview size changes (e.g., when window is resized)
  window.addEventListener('resize', () => {
    if (cropGuides.classList.contains('visible')) {
      updateCropGuides();
    }
  });

  // Initialize guides after webview loads
  webview.addEventListener('dom-ready', () => {
    // Give webview time to settle and get correct dimensions
    setTimeout(() => {
      // ONLY show guides if URL matches trigger
      if (checkUrlForCropGuidesTrigger(webview.src)) {
        console.log('URL contains crop guides trigger, showing guides');
        updateCropGuides();
      }
    }, 1000);
  });

  // Add event listener for the show guides button
  btnShowCropGuides.addEventListener('click', () => {
    updateCropGuides(false);
    
    // Toggle button text
    if (cropGuides.classList.contains('visible')) {
      btnShowCropGuides.textContent = 'Show Crop Guides';
    } else {
      btnShowCropGuides.textContent = 'Hide Crop Guides';
    }
  });

  cacheCleanInterval.addEventListener('change', () => {
    saveConfig();
    setupCacheCleanupTimer();
  });

  siteProfileSelect.addEventListener('change', () => {
    const profileId = siteProfileSelect.value;
    loadProfileDetails(profileId);
    activeProfileId = profileId;
    saveConfig();
  });

  // Add event listener for webview navigation
  webview.addEventListener('did-navigate', (event) => {
    const url = event.url;
    checkAndSwitchProfile(url);
  });

  webview.addEventListener('did-navigate-in-page', (event) => {
    const url = event.url;
    checkAndSwitchProfile(url);
  });

  // Update cache info initially 
  updateCacheInfo();

  // Set up periodic cache info updates
  setInterval(updateCacheInfo, 60000); // Update every minute

  // Add event listeners for all buttons
  btnStartCapture.addEventListener('click', startCapture);
  btnStopCapture.addEventListener('click', stopCapture);
  btnLoadUrl.addEventListener('click', loadURL);
  btnSelectDir.addEventListener('click', selectOutputDirectory);
  btnSaveConfig.addEventListener('click', saveConfig);
  btnDefaultConfig.addEventListener('click', resetConfigToDefaults);
  btnApplyRules.addEventListener('click', () => {
    saveBlockingRules();
    applyBlockingRules();
  });
  btnResetRules.addEventListener('click', resetRules);
  btnClearCache.addEventListener('click', clearBrowserCache);
  btnClearCookies.addEventListener('click', clearCookies);
  btnClearAll.addEventListener('click', clearAllData);
  btnSaveProfile.addEventListener('click', saveCurrentProfile);
  btnDeleteProfile.addEventListener('click', deleteCurrentProfile);

  // Add collapsible section functionality
  toggleAdvancedSettings.addEventListener('click', () => {
    advancedSettingsContent.classList.toggle('hidden');
    toggleAdvancedSettings.textContent = advancedSettingsContent.classList.contains('hidden') ? '▼' : '▲';
  });
  
  // Add enter key handling for URL input
  inputUrl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
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
        statusText.textContent = 'Playback ended, capture stopped automatically';
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error in playback end detection:', error);
      return false;
    }
  }

  // Toggle visibility of auto-start fields
  autoStartPlayback.addEventListener('change', () => {
    const autoStartFields = document.querySelectorAll('#playButtonSelector, #countdownSelector');
    const autoStartLabels = document.querySelectorAll('label[for="playButtonSelector"], label[for="countdownSelector"]');
    const helpTexts = autoStartPlayback.closest('.setting-item').nextElementSibling.querySelectorAll('.help-text');
    
    if (autoStartPlayback.checked) {
      autoStartFields.forEach(field => field.closest('.setting-item').style.display = 'block');
      autoStartLabels.forEach(label => label.style.display = 'inline-block');
      helpTexts.forEach(help => help.style.display = 'block');
    } else {
      autoStartFields.forEach(field => field.closest('.setting-item').style.display = 'none');
      autoStartLabels.forEach(label => label.style.display = 'none');
      helpTexts.forEach(help => help.style.display = 'none');
    }
  });
  
  // Initial display state
  if (!autoStartPlayback.checked) {
    const autoStartFields = document.querySelectorAll('#playButtonSelector, #countdownSelector');
    const autoStartLabels = document.querySelectorAll('label[for="playButtonSelector"], label[for="countdownSelector"]');
    const helpTexts = autoStartPlayback.closest('.setting-item').nextElementSibling.querySelectorAll('.help-text');
    
    autoStartFields.forEach(field => field.closest('.setting-item').style.display = 'none');
    autoStartLabels.forEach(label => label.style.display = 'none');
    helpTexts.forEach(help => help.style.display = 'none');
  }

  // Toggle visibility of auto-detect-end fields
  autoDetectEnd.addEventListener('change', () => {
    const endDetectionField = document.getElementById('endDetectionSelector');
    const endDetectionLabel = document.querySelector('label[for="endDetectionSelector"]');
    const helpText = endDetectionField.closest('.setting-item').querySelector('.help-text');
    
    if (autoDetectEnd.checked) {
      endDetectionField.closest('.setting-item').style.display = 'block';
      endDetectionLabel.style.display = 'inline-block';
      helpText.style.display = 'block';
    } else {
      endDetectionField.closest('.setting-item').style.display = 'none';
      endDetectionLabel.style.display = 'none';
      helpText.style.display = 'none';
    }
  });

  // Initial display state for auto-detect-end
  if (!autoDetectEnd.checked) {
    const endDetectionField = document.getElementById('endDetectionSelector');
    const endDetectionLabel = document.querySelector('label[for="endDetectionSelector"]');
    const helpText = endDetectionField.closest('.setting-item').querySelector('.help-text');
    
    endDetectionField.closest('.setting-item').style.display = 'none';
    endDetectionLabel.style.display = 'none';
    helpText.style.display = 'none';
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
        statusText.textContent = 'Video playing, starting capture';
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
        statusText.textContent = 'Clicked play, verifying...';
        
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
              
              statusText.textContent = 'Auto-started playback';
              playbackRetryAttempts = 0;
              
              // Wait a moment for video to stabilize before starting capture
              setTimeout(() => {
                if (!captureInterval) {
                  console.log('Auto-starting capture after playback began');
                  startCapture();
                }
              }, 2000);
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
          statusText.textContent = `Waiting for live stream: ${countdownCheck.info.trim()}`;
          // Reset retry counter when waiting for countdown
          playbackRetryAttempts = 0;
        }
      }
    } catch (error) {
      console.error('Error in checkAndAutoStartPlayback:', error);
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

  allowBackgroundRunning.addEventListener('change', async () => {
    try {
      if (allowBackgroundRunning.checked) {
        await window.electronAPI.enableBackgroundRunning();
        statusText.textContent = 'Background running enabled';
      } else {
        await window.electronAPI.disableBackgroundRunning();
        statusText.textContent = 'Background running disabled';
      }
      
      // Reset status text after 2 seconds
      setTimeout(() => {
        statusText.textContent = captureInterval ? 'Capturing...' : 'Idle';
      }, 2000);
      
      // Save the new setting
      saveConfig();
    } catch (error) {
      console.error('Error toggling background running:', error);
    }
  });
});